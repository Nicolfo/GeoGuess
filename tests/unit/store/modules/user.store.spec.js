jest.mock('firebase/database', () => ({}));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/app', () => {
    const database = jest.fn();
    database.ServerValue = { TIMESTAMP: 1000 };
    return { __esModule: true, default: { database } };
});

import firebase from 'firebase/app';
import userStore from '@/store/modules/user.store';
import * as MutationTypes from '@/store/mutation-types';

describe('user.store.js', () => {
    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it('USER_SET_PROFILE fills missing stats with defaults', () => {
        const state = {};
        userStore.mutations[MutationTypes.USER_SET_PROFILE](state, {
            uid: 'u1',
            displayName: 'Bob',
            stats: { gamesPlayed: 3 },
        });
        expect(state.uid).toEqual('u1');
        expect(state.displayName).toEqual('Bob');
        expect(state.loaded).toBe(true);
        expect(state.stats).toEqual({
            gamesPlayed: 3,
            totalPoints: 0,
            bestPoints: 0,
            placeVisits: 0,
            perfectRounds: 0,
        });
    });

    it('recordGame aggregates the finished game into lifetime stats', () => {
        const commit = jest.fn();
        const state = { uid: 'u1', displayName: 'Bob', stats: {} };

        let captured;
        const refObj = {
            transaction: (updater, onComplete) => {
                const current = {
                    gamesPlayed: 2,
                    totalPoints: 100,
                    bestPoints: 60,
                    placeVisits: 10,
                    perfectRounds: 1,
                };
                captured = updater(current);
                onComplete(null, true, { val: () => captured });
            },
        };
        firebase.database.mockReturnValue({ ref: jest.fn(() => refObj) });

        userStore.actions.recordGame(
            { state, commit },
            {
                points: 80,
                rounds: [
                    { points: 5000 },
                    { points: 3000 },
                    { points: 5000 },
                ],
            }
        );

        expect(captured).toEqual({
            gamesPlayed: 3,
            totalPoints: 180,
            bestPoints: 80,
            placeVisits: 13,
            perfectRounds: 3,
        });
        expect(commit).toHaveBeenCalledWith(MutationTypes.USER_SET_PROFILE, {
            uid: 'u1',
            displayName: 'Bob',
            stats: captured,
        });
    });

    it('recordGame is a no-op without an authenticated uid', () => {
        const commit = jest.fn();
        const ref = jest.fn();
        firebase.database.mockReturnValue({ ref });

        userStore.actions.recordGame({ state: { uid: null }, commit }, {
            points: 10,
            rounds: [],
        });

        expect(ref).not.toHaveBeenCalled();
        expect(commit).not.toHaveBeenCalled();
    });

    it('initUser creates the profile on first sign-in', async () => {
        const commit = jest.fn();
        const set = jest.fn(() => Promise.resolve());
        const once = jest.fn(() => Promise.resolve({ exists: () => false }));
        firebase.database.mockReturnValue({
            ref: jest.fn(() => ({ once, set })),
        });
        localStorage.setItem('playerName', 'Alice');

        await userStore.actions.initUser({ commit, state: { uid: null } }, 'u2');

        expect(set).toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith(
            MutationTypes.USER_SET_PROFILE,
            expect.objectContaining({ uid: 'u2', displayName: 'Alice' })
        );
    });

    it('initUser loads an existing profile without overwriting it', async () => {
        const commit = jest.fn();
        const set = jest.fn(() => Promise.resolve());
        const once = jest.fn(() =>
            Promise.resolve({
                exists: () => true,
                val: () => ({
                    displayName: 'Existing',
                    stats: { gamesPlayed: 5 },
                }),
            })
        );
        firebase.database.mockReturnValue({
            ref: jest.fn(() => ({ once, set })),
        });

        await userStore.actions.initUser({ commit, state: { uid: null } }, 'u3');

        expect(set).not.toHaveBeenCalled();
        expect(commit).toHaveBeenCalledWith(
            MutationTypes.USER_SET_PROFILE,
            expect.objectContaining({
                uid: 'u3',
                displayName: 'Existing',
                stats: { gamesPlayed: 5 },
            })
        );
    });

    it('initUser does nothing when the uid is already loaded', async () => {
        const commit = jest.fn();
        const ref = jest.fn();
        firebase.database.mockReturnValue({ ref });

        await userStore.actions.initUser(
            { commit, state: { uid: 'same' } },
            'same'
        );

        expect(ref).not.toHaveBeenCalled();
        expect(commit).not.toHaveBeenCalled();
    });

    it('setDisplayName commits and persists a capped name', async () => {
        const commit = jest.fn();
        const set = jest.fn(() => Promise.resolve());
        firebase.database.mockReturnValue({ ref: jest.fn(() => ({ set })) });

        await userStore.actions.setDisplayName(
            { commit, state: { uid: 'u1' } },
            'a'.repeat(30)
        );

        expect(commit).toHaveBeenCalledWith(
            MutationTypes.USER_SET_DISPLAY_NAME,
            'a'.repeat(20)
        );
        expect(set).toHaveBeenCalledWith('a'.repeat(20));
    });
});
