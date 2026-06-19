import StreetViewService from '@/plugins/StreetViewService';

class GoogleMockService{

    constructor(...args){
        this.args = args;
    }

    getPanorama(){
        return true;
    }
}


window.google = {
    maps: {
        StreetViewService: GoogleMockService,
        LatLng: GoogleMockService,
        StreetViewStatus: {
            OK: 200
        },
        StreetViewSource: {
            DEFAULT: 'default',
            OUTDOOR: 'outdoor',
            GOOGLE: 'google'
        }
    }
};

describe('StreetViewService', ()=>{


    it('constructor should set right value', ()=>{

        const streetviewServiceObj = new StreetViewService(
            {allPanorama: true}, 
            {mode: 'country'}
        );
        expect(streetviewServiceObj.settingsPanorama.allPanorama).toBeTruthy();
        expect(streetviewServiceObj.settingsGame.mode).toEqual('country');
    });

    it('getStreetView: should return roundPredefined', () => {

        const streetviewServiceObj = new StreetViewService(
            {allPanorama: true}, 
            {mode: 'country'},
            null,
            [[0,1], [2,3], [4,5]]
        );
        
        const spy = jest.spyOn(streetviewServiceObj.service, 'getPanorama');
        streetviewServiceObj.getStreetView(2);

        expect(spy).toHaveBeenCalledWith(
            {"location": {"args": [2, 3]}, "preference": "nearest", "radius": 50, "sources": ["default", "outdoor", "google"]},
            expect.any(Function)
        );

    });

    it('getStreetView: throws after the maximum number of attempts', async () => {
        const streetviewServiceObj = new StreetViewService(
            { allPanorama: true },
            { mode: 'classic' },
            null,
            [[0, 1]]
        );

        await expect(
            streetviewServiceObj.getStreetView(1, 0, 50)
        ).rejects.toThrow(/after 50 attempts/);
    });

    it('_getResponseStreetViewService: degrades gracefully when area lookup keeps failing', async () => {
        const streetviewServiceObj = new StreetViewService(
            {},
            { mode: 'country' }
        );
        streetviewServiceObj._getAreaCode = jest.fn(() => {
            throw new Error('area service down');
        });
        const data = {
            id: 'pano',
            location: { latLng: { lng: () => 0, lat: () => 0 } },
        };

        // attempts + 1 reaches the cap, so it must resolve instead of recursing.
        const res = await streetviewServiceObj._getResponseStreetViewService(
            1,
            data,
            0,
            null,
            49
        );

        expect(res.panorama).toBe(data);
        expect(res.area).toBeNull();
        expect(res.warning).toBe(true);
    });

    it('_getResponseStreetViewService: should return panorama', async () => {
        
        const streetviewServiceObj = new StreetViewService({},{
            mode: 'classic'
        });

        const res = await streetviewServiceObj._getResponseStreetViewService(0, {
            id: '121'
        });

        expect(res.panorama).toEqual({id: '121'});
        expect(res.area).toBeUndefined();
        expect(res.roundInfo).toBeNull();
        expect(res.warning).toBeFalsy();
    });

    it('_checkStreetView should return true', () => {
              
        const streetviewServiceObj = new StreetViewService({
            optimiseStreetView: false,
        });

        const res = streetviewServiceObj._checkStreetView({
            imageDate: new Date(),
            links: ['0','1'],
            g: [0,2]
        });

        expect(res).toBeTruthy();
    });

    it('_checkStreetView should return false because links', () => {
              
       
        const streetviewServiceObj = new StreetViewService({
            optimiseStreetView: true,
        });

        const res = streetviewServiceObj._checkStreetView({
            imageDate: new Date(),
            links: ['0'],
            g: []
        });

        expect(res).toBeFalsy();
    });

    it('_checkStreetView should return false because settings', () => {
              
        const streetviewServiceObj = new StreetViewService({
            optimiseStreetView: true,
        });

        const res = streetviewServiceObj._checkStreetView({
            imageDate: new Date(),
            links: ['0','1'],
            g: [0],
        });

        expect(res).toBeFalsy();
    });

    it('getRandomLatLng should return random lat lng without properties', () => {

        const streetviewServiceObj = new StreetViewService();

        const res = streetviewServiceObj.getRandomLatLng();
        expect(res.properties).toBeNull();
        expect(res.position).toBeDefined();
        expect(res.radius).toBeDefined();

    });

    it('getRandomLatLng should return lat lng from GeoJson', () => {

        const streetviewServiceObj = new StreetViewService({}, {}, {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [0,1]
                },
                properties:{
                    title: 'hello'
                }
            }]
        });


        const res = streetviewServiceObj.getRandomLatLng();
        expect(res.properties).toEqual({
            title: 'hello'
        });
        expect(res.position.args).toEqual([1,0]);
        expect(res.radius).toBeDefined();
    });




});