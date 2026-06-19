jest.mock('firebase/database', () => ({}));
jest.mock('firebase/app', () => {
    const database = jest.fn();
    database.ServerValue = { TIMESTAMP: 1000 };
    return { __esModule: true, default: { database } };
});

import firebase from 'firebase/app';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import appInit from '../../testutils/appInit';
import Chat from '@/components/game/Chat.vue';

const args = appInit(createLocalVue());

function setupFirebase({ history = [] } = {}) {
    const on = jest.fn();
    const push = jest.fn(() => Promise.resolve());
    const off = jest.fn();
    // `once('value')` loads the existing history; emulate Firebase's snapshot
    // by replaying the provided messages through `forEach`.
    const once = jest.fn((event, cb) => {
        cb({
            forEach: (fn) =>
                history.forEach((m) => fn({ key: m.id, val: () => m })),
        });
    });
    const query = { on, off, once };
    const chatRef = {
        limitToLast: jest.fn(() => query),
        push,
    };
    firebase.database.mockReturnValue({
        ref: jest.fn(() => ({ child: jest.fn(() => chatRef) })),
    });
    return { on, push, off, once };
}

function mountChat() {
    return shallowMount(Chat, {
        ...args,
        propsData: {
            roomName: 'myroom',
            playerNumber: 2,
            playerName: 'Bob',
        },
    });
}

describe('Chat.vue', () => {
    afterEach(() => jest.clearAllMocks());

    it('subscribes to the room chat node on creation', () => {
        const { on } = setupFirebase();
        mountChat();
        expect(on).toHaveBeenCalledWith('child_added', expect.any(Function));
    });

    it('loads existing history without counting it as unread', () => {
        setupFirebase({
            history: [
                { id: 'm1', message: 'hi', playerName: 'X', playerNumber: 1 },
                { id: 'm2', message: 'yo', playerName: 'Y', playerNumber: 3 },
            ],
        });
        const wrapper = mountChat();

        expect(wrapper.vm.messages).toHaveLength(2);
        expect(wrapper.vm.unread).toEqual(0);
    });

    it('ignores child_added replays of already-loaded history', () => {
        setupFirebase({
            history: [
                { id: 'm1', message: 'hi', playerName: 'X', playerNumber: 1 },
            ],
        });
        const wrapper = mountChat();

        // Firebase replays existing children through child_added when the
        // listener attaches; this must not duplicate them nor bump unread.
        wrapper.vm.onMessage({
            key: 'm1',
            val: () => ({ message: 'hi', playerName: 'X', playerNumber: 1 }),
        });

        expect(wrapper.vm.messages).toHaveLength(1);
        expect(wrapper.vm.unread).toEqual(0);
    });

    it('sends a trimmed, length-capped message and clears the draft', () => {
        const { push } = setupFirebase();
        const wrapper = mountChat();

        wrapper.vm.draft = '  hello  ';
        wrapper.vm.sendMessage();

        expect(push).toHaveBeenCalledWith({
            message: 'hello',
            playerNumber: 2,
            playerName: 'Bob',
            timestamp: 1000,
        });
        expect(wrapper.vm.draft).toEqual('');
    });

    it('caps the message at 200 characters', () => {
        const { push } = setupFirebase();
        const wrapper = mountChat();

        wrapper.vm.draft = 'a'.repeat(250);
        wrapper.vm.sendMessage();

        expect(push.mock.calls[0][0].message).toHaveLength(200);
    });

    it('does not send a blank message', () => {
        const { push } = setupFirebase();
        const wrapper = mountChat();

        wrapper.vm.draft = '    ';
        wrapper.vm.sendMessage();

        expect(push).not.toHaveBeenCalled();
    });

    it('tracks unread messages while the panel is closed', () => {
        setupFirebase();
        const wrapper = mountChat();

        wrapper.vm.onMessage({
            key: 'm1',
            val: () => ({ message: 'hi', playerName: 'X', playerNumber: 1 }),
        });

        expect(wrapper.vm.messages).toHaveLength(1);
        expect(wrapper.vm.unread).toEqual(1);

        wrapper.vm.toggle();
        expect(wrapper.vm.open).toBe(true);
        expect(wrapper.vm.unread).toEqual(0);
    });

    it('detaches the listener before destroy', () => {
        const { off } = setupFirebase();
        const wrapper = mountChat();
        wrapper.destroy();
        expect(off).toHaveBeenCalledWith('child_added', expect.any(Function));
    });

    it('starts listening for new messages after loading history', () => {
        const { on } = setupFirebase({
            history: [
                { id: 'm1', message: 'hi', playerName: 'X', playerNumber: 1 },
            ],
        });
        mountChat();

        // The live listener is attached only once history has been loaded.
        expect(on).toHaveBeenCalledWith('child_added', expect.any(Function));
    });
});
