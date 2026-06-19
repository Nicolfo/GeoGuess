<template>
    <div class="chat-container">
        <v-btn
            fab
            small
            dark
            color="primary"
            class="chat-toggle"
            @click="toggle"
        >
            <v-badge
                :content="unread"
                :value="unread > 0"
                color="red"
                overlap
            >
                <v-icon>mdi-chat</v-icon>
            </v-badge>
        </v-btn>

        <v-card v-if="open" class="chat-panel">
            <v-card-title class="py-2 text-subtitle-1">
                {{ $t('Chat.title') }}
                <v-spacer />
                <v-btn icon small @click="toggle">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider />
            <div ref="messages" class="chat-messages">
                <p v-if="messages.length === 0" class="chat-empty">
                    {{ $t('Chat.empty') }}
                </p>
                <div
                    v-for="m in messages"
                    :key="m.id"
                    class="chat-message"
                    :class="{ own: m.playerNumber === playerNumber }"
                >
                    <span class="chat-author">{{ m.playerName }}</span>
                    <span class="chat-text">{{ m.message }}</span>
                </div>
            </div>
            <v-divider />
            <form class="chat-input" @submit.prevent="sendMessage">
                <v-text-field
                    v-model="draft"
                    :placeholder="$t('Chat.placeholder')"
                    :maxlength="maxLength"
                    hide-details
                    dense
                    solo
                    flat
                />
                <v-btn icon type="submit" :disabled="!draft.trim()">
                    <v-icon>mdi-send</v-icon>
                </v-btn>
            </form>
        </v-card>
    </div>
</template>

<script>
import firebase from 'firebase/app';
import 'firebase/database';

const MAX_MESSAGE_LENGTH = 200;

export default {
    name: 'Chat',
    props: {
        roomName: {
            type: String,
            required: true,
        },
        playerNumber: {
            type: Number,
            default: 0,
        },
        playerName: {
            type: String,
            default: '',
        },
    },
    data() {
        return {
            open: false,
            draft: '',
            messages: [],
            unread: 0,
            maxLength: MAX_MESSAGE_LENGTH,
            chatRef: null,
            chatQuery: null,
            initialLoaded: false,
        };
    },
    created() {
        // Keep a dedicated reference to the room's chat node so the component
        // works whether it is mounted in the lobby or during the game.
        this.chatRef = firebase
            .database()
            .ref(this.roomName)
            .child('chat');
        this.chatQuery = this.chatRef.limitToLast(50);
        // Load the existing history first without flagging it as unread, then
        // start listening for messages that genuinely arrive afterwards.
        // `child_added` replays every existing message when it first attaches,
        // so loading history separately is what stops already-seen messages
        // from being counted as "new" each time the component is recreated.
        this.chatQuery.once('value', (snapshot) => {
            snapshot.forEach((child) => {
                this.messages.push({ id: child.key, ...child.val() });
            });
            this.initialLoaded = true;
            this.$nextTick(this.scrollToBottom);
            this.chatQuery.on('child_added', this.onMessage);
        });
    },
    beforeDestroy() {
        if (this.chatQuery) {
            this.chatQuery.off('child_added', this.onMessage);
        }
    },
    methods: {
        onMessage(snapshot) {
            // `child_added` re-fires for the history already loaded above, so
            // skip anything we are already displaying.
            if (this.messages.some((m) => m.id === snapshot.key)) {
                return;
            }
            this.messages.push({ id: snapshot.key, ...snapshot.val() });
            if (!this.open) {
                this.unread += 1;
            }
            this.$nextTick(this.scrollToBottom);
        },
        scrollToBottom() {
            const el = this.$refs.messages;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        },
        toggle() {
            this.open = !this.open;
            if (this.open) {
                this.unread = 0;
                this.$nextTick(this.scrollToBottom);
            }
        },
        sendMessage() {
            const message = this.draft.trim().slice(0, MAX_MESSAGE_LENGTH);
            if (!message) {
                return;
            }
            this.draft = '';
            this.chatRef
                .push({
                    message,
                    playerNumber: this.playerNumber,
                    playerName: this.playerName,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                })
                .catch((error) => {
                    // eslint-disable-next-line no-console
                    console.error('Failed to send chat message:', error);
                });
        },
    },
};
</script>

<style scoped lang="scss">
.chat-toggle {
    position: fixed;
    left: 16px;
    top: 72px;
    z-index: 4;
}

.chat-panel {
    position: fixed;
    left: 16px;
    top: 128px;
    z-index: 4;
    width: 300px;
    max-width: calc(100vw - 32px);
    opacity: 0.95;
    display: flex;
    flex-direction: column;
}

.chat-messages {
    flex: 1;
    max-height: 260px;
    overflow-y: auto;
    padding: 8px 12px;
}

.chat-empty {
    opacity: 0.6;
    font-size: 0.85rem;
    text-align: center;
    margin: 8px 0;
}

.chat-message {
    margin-bottom: 6px;
    font-size: 0.9rem;
    word-break: break-word;

    &.own .chat-author {
        color: var(--v-primary-base);
    }
}

.chat-author {
    font-weight: 700;
    margin-right: 6px;
}

.chat-input {
    display: flex;
    align-items: center;
    padding: 4px 8px;
}
</style>
