import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import * as MutationTypes from '../mutation-types';

// A single round scores 5000 when the guess is within 50m.
const PERFECT_ROUND_POINTS = 5000;

function defaultStats() {
    return {
        gamesPlayed: 0,
        totalPoints: 0,
        bestPoints: 0,
        placeVisits: 0,
        perfectRounds: 0,
    };
}

export default {
    namespaced: true,
    state: () => ({
        uid: null,
        displayName: '',
        stats: defaultStats(),
        loaded: false,
    }),
    mutations: {
        [MutationTypes.USER_SET_PROFILE](state, { uid, displayName, stats }) {
            state.uid = uid;
            if (displayName != null) {
                state.displayName = displayName;
            }
            state.stats = { ...defaultStats(), ...(stats || {}) };
            state.loaded = true;
        },
        [MutationTypes.USER_SET_DISPLAY_NAME](state, displayName) {
            state.displayName = displayName;
        },
    },
    actions: {
        // Called once the (anonymous) auth state is known. Loads the profile
        // for this uid, creating it on first sign-in.
        async initUser({ commit, state }, uid) {
            if (!uid || state.uid === uid) {
                return;
            }
            const ref = firebase.database().ref('users/' + uid);
            try {
                const snapshot = await ref.once('value');
                let displayName;
                let stats;
                if (snapshot.exists()) {
                    const val = snapshot.val();
                    displayName = val.displayName;
                    stats = val.stats;
                } else {
                    displayName =
                        localStorage.getItem('playerName')?.slice(0, 20) || '';
                    stats = defaultStats();
                    await ref.set({
                        displayName,
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
                        stats,
                    });
                }
                commit(MutationTypes.USER_SET_PROFILE, {
                    uid,
                    displayName,
                    stats,
                });
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to load user profile:', error);
            }
        },
        async setDisplayName({ commit, state }, displayName) {
            const name = (displayName || '').slice(0, 20);
            commit(MutationTypes.USER_SET_DISPLAY_NAME, name);
            if (state.uid) {
                try {
                    await firebase
                        .database()
                        .ref('users/' + state.uid + '/displayName')
                        .set(name);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to save display name:', error);
                }
            }
        },
        // Aggregate a finished game into the lifetime stats. Uses a transaction
        // so concurrent writes (e.g. quick consecutive games) stay consistent.
        recordGame({ state, commit }, { points = 0, rounds = [] } = {}) {
            if (!state.uid) {
                return;
            }
            const perfect = rounds.filter(
                (round) => round && round.points === PERFECT_ROUND_POINTS
            ).length;

            firebase
                .database()
                .ref('users/' + state.uid + '/stats')
                .transaction(
                    (stats) => {
                        const next = { ...defaultStats(), ...(stats || {}) };
                        next.gamesPlayed += 1;
                        next.totalPoints += points;
                        next.bestPoints = Math.max(next.bestPoints, points);
                        next.placeVisits += rounds.length;
                        next.perfectRounds += perfect;
                        return next;
                    },
                    (error, committed, snapshot) => {
                        if (error) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to record game stats:', error);
                        } else if (committed && snapshot) {
                            commit(MutationTypes.USER_SET_PROFILE, {
                                uid: state.uid,
                                displayName: state.displayName,
                                stats: snapshot.val(),
                            });
                        }
                    }
                );
        },
    },
};
