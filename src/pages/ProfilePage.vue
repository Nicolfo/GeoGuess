<template>
    <ContentPage>
        <div class="content profile">
            <h1 class="profile__title">{{ $t('Profile.title') }}</h1>

            <v-text-field
                v-model="name"
                :label="$t('Profile.displayName')"
                :maxlength="20"
                counter="20"
                class="profile__name"
                @change="saveName"
            />

            <v-row class="profile__stats">
                <v-col
                    v-for="stat in statItems"
                    :key="stat.key"
                    cols="6"
                    sm="4"
                >
                    <v-card class="profile__stat" outlined>
                        <div class="profile__stat-value">{{ stat.value }}</div>
                        <div class="profile__stat-label">
                            {{ $t('Profile.stats.' + stat.key) }}
                        </div>
                    </v-card>
                </v-col>
            </v-row>
        </div>
    </ContentPage>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import ContentPage from '@/components/page/ContentPage';

export default {
    name: 'ProfilePage',
    components: {
        ContentPage,
    },
    data() {
        return {
            name: '',
        };
    },
    computed: {
        ...mapState('userStore', ['displayName', 'stats']),
        statItems() {
            return [
                { key: 'gamesPlayed', value: this.stats.gamesPlayed },
                { key: 'placeVisits', value: this.stats.placeVisits },
                { key: 'perfectRounds', value: this.stats.perfectRounds },
                { key: 'bestPoints', value: this.stats.bestPoints },
                { key: 'totalPoints', value: this.stats.totalPoints },
                {
                    key: 'averagePoints',
                    value: this.stats.gamesPlayed
                        ? Math.round(
                              this.stats.totalPoints / this.stats.gamesPlayed
                          )
                        : 0,
                },
            ];
        },
    },
    watch: {
        displayName: {
            immediate: true,
            handler(value) {
                this.name = value;
            },
        },
    },
    methods: {
        ...mapActions('userStore', ['setDisplayName']),
        saveName() {
            this.setDisplayName(this.name);
        },
    },
};
</script>

<style scoped lang="scss">
.profile {
    max-width: 700px;
    margin: 0 auto;
    padding: 1rem;
}
.profile__title {
    margin-bottom: 1rem;
}
.profile__name {
    max-width: 320px;
}
.profile__stat {
    text-align: center;
    padding: 1rem;
}
.profile__stat-value {
    font-size: 1.8rem;
    font-weight: 700;
}
.profile__stat-label {
    opacity: 0.7;
    font-size: 0.85rem;
}
</style>
