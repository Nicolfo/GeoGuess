import bbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import * as turfModel from '@turf/helpers';
import randomPositionInPolygon from 'random-position-in-polygon';
import { AREA_MODE, GAME_MODE } from '../constants';
import {
    getAreaCodeNameFromLatLng,
    getMaxDistanceBbox,
    isInGeoJSON
} from '../utils';

// Upper bound on how many random locations we probe before giving up, so a
// region with no Street View coverage (or an outage of the area-lookup API)
// can never recurse indefinitely.
const MAX_STREETVIEW_ATTEMPTS = 50;

class StreetViewService {
    constructor(
        settingsPanorama,
        settingsGame,
        placeGeoJson,
        roundsPredefined
    ) {
        this.settingsPanorama = settingsPanorama;
        this.settingsGame = settingsGame;
        this.placeGeoJson = placeGeoJson;
        this.roundsPredefined = roundsPredefined;
        this.service = new google.maps.StreetViewService();
        this.alreadyVisited = [];
    }

    async getStreetView(round, cptNotFoundLocation = 0, attempts = 0) {
        if (attempts >= MAX_STREETVIEW_ATTEMPTS) {
            throw new Error(
                `Unable to find a Street View location after ${attempts} attempts`
            );
        }
        let radius, position, randomFeatureProperties;
        if (this.roundsPredefined) {
            radius = 50;
            const positions = this.roundsPredefined[round - 1];
            position = new google.maps.LatLng(positions[0], positions[1]);
        } else {
            let randomPos;
            do{
                randomPos = this.getRandomLatLng();
            } while(this.alreadyVisited.includes(randomPos.position.toString()));

            this.alreadyVisited.push(randomPos.position.toString());
            
            radius = randomPos.radius;
            position = randomPos.position;
            randomFeatureProperties = randomPos.properties;
        }

        return new Promise((resolve, reject) => {
            this.service.getPanorama(
                {
                    location: position,
                    preference: 'nearest',
                    radius,
                    sources: this.settingsPanorama.allPanorama
                        ? [google.maps.StreetViewSource.DEFAULT, google.maps.StreetViewSource.OUTDOOR, google.maps.StreetViewSource.GOOGLE]
                        : [google.maps.StreetViewSource.GOOGLE],
                },
                async (data, status) => {
                    try {
                        if (
                            status !== google.maps.StreetViewStatus.OK ||
                            !data ||
                            !data.location ||
                            !this._checkStreetView(data)
                        ) {
                            // No usable panorama here: probe another location.
                            resolve(
                                await this.getStreetView(
                                    round,
                                    cptNotFoundLocation,
                                    attempts + 1
                                )
                            );
                        } else {
                            resolve(
                                await this._getResponseStreetViewService(
                                    round,
                                    data,
                                    cptNotFoundLocation,
                                    randomFeatureProperties,
                                    attempts
                                )
                            );
                        }
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        });
    }

    async _getResponseStreetViewService(
        round,
        data,
        cptNotFoundLocation,
        randomFeatureProperties,
        attempts = 0
    ) {
        let isInGeoJSONResult, isVisibleDialog = false;
        if (this.placeGeoJson != null) {
            isInGeoJSONResult = isInGeoJSON(
                turfModel.point([
                    data.location.latLng.lng(),
                    data.location.latLng.lat(),
                ]),
                this.placeGeoJson
            );
        }
        if (isInGeoJSONResult === false && cptNotFoundLocation < 3) {
            return this.getStreetView(
                round,
                cptNotFoundLocation + 1,
                attempts + 1
            );
        } else {
            // If 3 times Street View does not find location in the polygon placeGeoJson print warning message
            if (isInGeoJSONResult === false) {
                isVisibleDialog = true;
            }
            let areaCode = null;
            try{
                areaCode = await this._getAreaCode(data);
            }catch(err){
                if (attempts + 1 < MAX_STREETVIEW_ATTEMPTS) {
                    // Retry at a new location; the area lookup may transiently fail.
                    return this.getStreetView(
                        round,
                        cptNotFoundLocation,
                        attempts + 1
                    );
                }
                // Out of attempts: keep this (valid) panorama playable, but flag
                // that the area could not be resolved.
                isVisibleDialog = true;
            }

            return {
                panorama: data,
                roundInfo: randomFeatureProperties || null,
                area: areaCode,
                warning: isVisibleDialog,
            };
        }
    }
    

    getRandomLatLng() {
        if (this.placeGeoJson != null) {
            let position,
                radius,
                properties = null;
            if (this.placeGeoJson.type === 'FeatureCollection') {  
                let randInt = Math.floor(
                    Math.random() * this.placeGeoJson.features.length
                );

                const feature = this.placeGeoJson.features[randInt];
                properties = feature.properties;
                if (feature.geometry.type === 'Point') {
                    position = feature.geometry.coordinates;
                    radius = 50;
                } else {
                    radius = getMaxDistanceBbox(bbox(feature)) * 10;
                    position = randomPositionInPolygon(feature);
                }
            } else {
                radius = getMaxDistanceBbox(bbox(this.placeGeoJson)) * 10;
                position = randomPositionInPolygon(this.placeGeoJson);
            }

            return {
                radius,
                position: new google.maps.LatLng(position[1], position[0]),
                properties,
            };
        }

        // Generate a random latitude and longitude
        const lat = (Math.acos(Math.random() * 1.99 - 0.995) * 57.2958) - 90;
        const lng = Math.random() * 360 - 180;

        return {
            radius: 100000,
            position: new google.maps.LatLng(lat, lng),
            properties: null,
        };
    }

    _checkStreetView(data) {
        return !(
            this.settingsPanorama.optimiseStreetView && 
                (
                    !data.imageDate ||
                    data.links.length < 2 ||
                    (Array.isArray(data.g) && data.g.length !== 0)
                )
        );
    }

    async _getAreaCode(data){
        if (
            [GAME_MODE.COUNTRY, GAME_MODE.CUSTOM_AREA].includes(
                this.settingsGame.mode
            )
        ) {
            if (
                this.settingsGame.mode === GAME_MODE.COUNTRY ||
                (this.settingsGame.areaParams &&
                    this.settingsGame.areaParams.data.type ===
                        AREA_MODE.NOMINATIM)
            ) {
                return getAreaCodeNameFromLatLng(
                    data.location.latLng,
                    this.settingsGame.areaParams &&
                        this.settingsGame.areaParams.data
                );
            } else {
                const area = this.settingsGame.areasJson.features.find(
                    (feature) =>
                        booleanPointInPolygon(
                            [
                                data.location.latLng.lng(),
                                data.location.latLng.lat(),
                            ],
                            feature
                        )
                );

                if (!area) {
                    throw new Error('Area not found');
                } else {
                    const key = this.settingsGame.areaParams
                        ? this.settingsGame.areaParams.data.pathKey
                        : 'iso_a2';
                    return area.properties[key];
                }
            }
        }
    }
}


export default StreetViewService;
