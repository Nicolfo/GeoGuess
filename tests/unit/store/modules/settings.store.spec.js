jest.mock('@/lang', ()=>{
    return {
        t: (k)=> k
    };
});

jest.mock('firebase/database', () => ({}));
jest.mock('firebase/app', () => {
    const database = jest.fn();
    database.ServerValue = { TIMESTAMP: 1000 };
    return { __esModule: true, default: { database } };
});

import firebase from 'firebase/app';
import { GAME_MODE } from '@/constants';
import * as MutationTypes from '@/store/mutation-types';
import { default as settingsStore, GameSettings } from '@/store/modules/settings.store';

// Build a room reference whose transaction runs the real updater against the
// given server snapshot, so the slot-assignment / rejection logic is exercised.
function mockRoom(serverData) {
    const removeOnDisconnect = { remove: jest.fn() };
    return {
        transaction: jest.fn((updater, onComplete) => {
            const result = updater(serverData);
            onComplete(null, result !== undefined, { val: () => result });
        }),
        child: jest.fn(() => ({
            onDisconnect: jest.fn(() => removeOnDisconnect),
        })),
        update: jest.fn(),
        off: jest.fn(),
    };
}

function setupRoom(serverData) {
    const room = mockRoom(serverData);
    firebase.database.mockReturnValue({ ref: jest.fn(() => room) });
    return room;
}

function baseState() {
    return {
        isOpenDialogRoom: true,
        loadRoom: false,
        name: 'Bob',
        currentComponent: '',
        playerNumber: 0,
        roomErrorMessage: null,
    };
}

describe('settingsStore.js', () => {
    it('SETTINGS_SET_GAME_SETTINGS', ()=>{
        let state = {gameSettings: new GameSettings()};
        expect(
            state.gameSettings.allPanorama).toBeFalsy();
        settingsStore.mutations[MutationTypes.SETTINGS_SET_GAME_SETTINGS](state, {allPanorama: true});
        expect(
            state.gameSettings.allPanorama).toBeTruthy();
        expect(state.gameSettings.modeSelected).toEqual('classic');

        settingsStore.mutations[MutationTypes.SETTINGS_SET_GAME_SETTINGS](state, {areaParams: {title: '111'}});
        expect(state.gameSettings.areaParams.title).toEqual('111');
        expect(state.gameSettings.modeSelected).toEqual(GAME_MODE.CUSTOM_AREA);

        settingsStore.mutations[MutationTypes.SETTINGS_SET_GAME_SETTINGS](state, {modeSelected: 'country'});
        expect(state.gameSettings.areaParams).toBeNull();
        expect(state.gameSettings.modeSelected).toEqual('country');
        expect(state.gameSettings.optimiseStreetView).toBeTruthy();

    });

    describe('SETTINGS_SET_ROOM (atomic join)', () => {
        afterEach(() => jest.clearAllMocks());

        it('makes the joiner of an empty room the host', () => {
            const room = setupRoom(null);
            const state = baseState();

            settingsStore.mutations[MutationTypes.SETTINGS_SET_ROOM](
                state,
                'myroom'
            );

            expect(room.transaction).toHaveBeenCalled();
            expect(state.playerNumber).toEqual(1);
            expect(state.currentComponent).toEqual('settingsMap');
            expect(state.roomErrorMessage).toBeNull();
            expect(room.update).toHaveBeenCalled(); // createdAt timestamp
        });

        it('assigns the next free slot to a joining player', () => {
            setupRoom({ playerName: { player1: 'Alice' } });
            const state = baseState();

            settingsStore.mutations[MutationTypes.SETTINGS_SET_ROOM](
                state,
                'myroom'
            );

            expect(state.playerNumber).toEqual(2);
            expect(state.currentComponent).toEqual('playerName');
        });

        it('rejects a player when the room is full', () => {
            setupRoom({
                playerName: {
                    player1: 'a',
                    player2: 'b',
                    player3: 'c',
                    player4: 'd',
                    player5: 'e',
                    player6: 'f',
                },
            });
            const state = baseState();

            settingsStore.mutations[MutationTypes.SETTINGS_SET_ROOM](
                state,
                'myroom'
            );

            expect(state.playerNumber).toEqual(0);
            expect(state.roomErrorMessage).toEqual('DialogRoom.roomIsFull');
        });

        it('rejects a player when the game already started', () => {
            setupRoom({ started: true, playerName: { player1: 'a' } });
            const state = baseState();

            settingsStore.mutations[MutationTypes.SETTINGS_SET_ROOM](
                state,
                'myroom'
            );

            expect(state.playerNumber).toEqual(0);
            expect(state.roomErrorMessage).toEqual('DialogRoom.alreadyStarted');
        });
    });

    it('setPlayerName will commit playerName', ()=>{
        const spy = jest.spyOn(window.localStorage.__proto__, 'setItem');
        const commit = jest.fn();
        settingsStore.actions.setPlayerName({commit}, 'Toto');

        expect(commit).toBeCalledWith(MutationTypes.SETTINGS_SET_PLAYER_NAME,'Toto');
        expect(spy).toHaveBeenCalledWith('playerName', 'Toto');
    });

});
