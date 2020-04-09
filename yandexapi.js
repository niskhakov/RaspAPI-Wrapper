const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { defaultDate, binarySearchPositiveMinIdx, getTimeDifferenceFromNow } = require("./utils")
const { Storage } = require("./dynamodb.js");
// const logger = require('pino')()


const hint_level = {
    "STARTS_WITH": "STARTS_WITH",
    "INCLUDES_STR": "INCLUDES_STR"
}

const config = {
    // Список напралений, которые связаны с Москвой
    directions_of_interest: [
        "Савёловское",
        "Московское", // Казанское
        "Казанское",
        "Горьковское",
        "Павелецкое",
        "Ярославское",
        "МЦД-2",
        "Киевское",
        "Курское",
        "Рижское",
        "Белорусское",
        "МЦК: Московское центральное кольцо",
        "Ленинградское",
        "Московский монорельс",
        "МЦД-1"
    ],
    // Файл, где хранится обработанный объект всех станций соответствующих напрлений
    // cache_stations_filename: "res/yandex-stations.json",
    cache_stations_filename: "res/yandex-stations-compressed.json",
    // Интересующая страна в Yandex.API
    yandex_countryName: "Россия",
    // Интересующий регион в Yandex.API
    yandex_region: "Москва и Московская область",

    // Уровень пользовательских подсказок: 
    // STARTS_WITH - предлагаются только те станции, которые начинаются со строки, введенной пользователем
    // INCLUDES_STR - предлагаются те станции, которые включают в себя строку, введенную пользователем (более требователен к ресурсам)
    yandex_hint_level: hint_level.INCLUDES_STR
};

class YandexTrainsAPI {
    /**
     * @constructor
     */
    constructor(yandextoken) {
        this.token = yandextoken;
        this.cacheStationsFilename = config.cache_stations_filename;
    }

    /**
     * @access public
     * 
     * TODO: use more efficient structure for cached stations instead of array (use hashmap)
     */
    getHint(unfinishedStationName) {
        // list of stations that starts with `unfinishedStationName`
        unfinishedStationName = unfinishedStationName.trim().toLowerCase();
        if (!this.stationsMap) this.fetchCachedStations();

        let choices = [];
        Object.keys(this.stationsMap).forEach(station => {
            switch (config.yandex_hint_level) {
                case hint_level.INCLUDES_STR:
                    if (station.toLowerCase().includes(unfinishedStationName)) {
                        choices.push(this.stationsMap[station]);
                    }
                    break;
                case hint_level.STARTS_WITH:
                    if (station.toLowerCase().startsWith(unfinishedStationName)) {
                        choices.push(this.stationsMap[station]);
                    }
            }

        });
        return choices;
    };

    /**
     * @access protected
     */
    fetchCachedStations() {
        this.stationsMap = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, config.cache_stations_filename))
        );
    };

    /**
     * @access public
     * @param {string} stationName - Station name (case insensitive)
     */
    getStationObject(stationName) {
        if (!this.stationsMap) this.fetchCachedStations();
        if (!stationName) return undefined;
        return this.stationsMap[stationName.toLowerCase()];
    }

    /**
     * @access public
     * 
     * @param {string} departure - Departure station (case insensitive)
     * @param {string} destination - Destination station (case insensitive)
     * @param {Object} [extra] - Extra parameters
     * @param {string} [extra.schedule_items=1] - number of schedule items from now, may be less if number of trains is less for specified date
     * @param {string} [extra.date=Utils.defaultDate()] - specify date of schedule, by default current date specified in Utils.defaultDate()
     */
    async getSchedule(departure, destination, extra = {}) {
        const depObj = this.getStationObject(departure);
        const destObj = this.getStationObject(destination);

        return await this.getScheduleByID(depObj.id, destObj.id, extra)
    }

    /**
     * @access public
     * 
     * @param {string} departureId - Departure station id (in yandex database format: ex. s9600811)
     * @param {string} destinationId - Destination station id (in yandex database format: ex. s9600811)
     * @param {Object} [extra] - Extra parameters
     * @param {string} [extra.schedule_items=1] - number of schedule items from now, may be less if number of trains is less for specified date
     * @param {string} [extra.date=Utils.defaultDate()] - specify date of schedule, by default current date specified in Utils.defaultDate()
     */
    async getScheduleByID(departureId, destinationId, extra = {}) {
        extra = {
            schedule_items: 1,
            ...extra
        }
        const depObj = { id: departureId }
        const destObj = { id: destinationId }

        let schedule;
        try {
            schedule = await this.requestSchedule(depObj, destObj, extra);
        }
        catch (err) {
            // console.debug("Path doesn't exist or " + err.message);
            schedule = [];
        }

        let nearestScheduleIdx = binarySearchPositiveMinIdx(schedule, scheduleItem => getTimeDifferenceFromNow(scheduleItem.departure));

        if (nearestScheduleIdx === -1) {
            return [];
        }

        let result = [];
        let newIndex;
        for (let i = 0; i < extra.schedule_items; i++) {

            newIndex = i + nearestScheduleIdx;

            if (newIndex >= schedule.length) {
                break;
            }

            result.push(schedule[newIndex]);
        }

        return result;
    }

    /**
     * @access protected
     * 
     * Requesting schedule with complex logic of checking cache and if it doesn't exist it requests yandex api
     * @param {Object} departureObj - Departure station object returned by getStationObject
     * @param {Object} destinationObj - Destination station object returned by getStationObject
     * @param {Object} [extra] - Extra parameters
     * @param {string} [extra.date=Utils.defaultDate()] - specify date of schedule, by default current date specified in Utils.defaultDate()
     * @param {boolean} [extra.allow_database_query=true] - allow to check for cache object (without requesting API)
     * @param {boolean} [extra.allow_api_query=true] - allow to request API (without checking cache)
     * @param {boolean} [extra.allow_cache_write=true] - allow to write API responce to cache
     */
    async requestSchedule(departureObj, destinationObj, extra = {}) {

        if (!departureObj || !destinationObj) {
            return [];
        }

        extra = {
            date: defaultDate(),
            allow_database_query: true,
            allow_api_query: true,
            allow_cache_write: true,
            ...extra
        }
        const storage = new Storage();

        const writeCache = async(api) => {
            if (!extra.allow_cache_write) return false;
            // console.log("API query requested to be cached")

            return storage.write(extra.date, departureObj.id, destinationObj.id, api);
        }

        const getCache = async() => {
            if (!extra.allow_database_query) throw new Error("Cache query is not allowed");
            // console.log("Database query requested");

            let cache = await storage.get(extra.date, departureObj.id, destinationObj.id);
            let res = cache.Item.Payload;
            if (res.length === 0) {
                throw Error("Empty cache");
            }
            return res;
        }

        const getAPI = () => {
            if (!extra.allow_api_query) throw new Error("API query not allowed");
            // console.log("API query requested")
            return this.requestEntireScheduleFromYandexAPI(departureObj.id, destinationObj.id, extra)

        }

        let cache;
        let api;

        try {
            cache = await getCache();
            // console.log("Cache retrieved")
        }
        catch (err) {
            api = await getAPI();
            // console.log("API retrieved")
            writeCache(api);
        }

        if (cache !== undefined && cache.length !== 0) {
            return cache;
        }
        else if (api !== undefined && api.length !== 0) {
            return api;
        }
        else {
            throw Error(`No data retrieved with specified extra parameters: ${JSON.stringify(extra)}`)
        }
    }


    /**
     * @access protected
     */
    async requestEntireScheduleFromYandexAPI(departureObjectId, destinationObjectId, extra = {}) {

        const simplifySegments = (segments, arrayToPush) => {
            segments.forEach(segment => {
                arrayToPush.push({
                    arrival: segment.arrival,
                    departure: segment.departure,
                    duration: segment.duration,
                    threadName: segment.thread.title
                })
            })

        }


        let recievedData = [];
        let total = 1,
            limit = 0,
            offset = 0;

        while ((offset + limit) <= total) {
            offset += limit;
            let page = await this.requestSchedulePageFromYandexAPI(departureObjectId, destinationObjectId, { ...extra, offset: offset });
            simplifySegments(page.data.segments, recievedData);
            ({ total, limit, offset } = page.data.pagination);
            // console.log(`Page: ${total}: ${offset}-${limit}`);
        }

        return recievedData;
    }


    /**
     * @access protected
     */
    requestSchedulePageFromYandexAPI(departureObjectId, destinationObjectId, extra = {}) {
        let date = extra.date || defaultDate();
        let offset = extra.offset || 0;
        let res = axios.get(
            "https://api.rasp.yandex.net/v3.0/search/", {
                params: {
                    apikey: this.token,
                    format: "json",
                    lang: "ru_RU",
                    from: departureObjectId,
                    to: destinationObjectId,
                    date: date,
                    transfers: 'false',
                    offset: offset
                }
            }
        )
        return res;
    }

    deleteScheduleFromCache(departureObjectId, destinationObjectId, date = defaultDate()) {
        const storage = new Storage();
        return storage.delete(date, departureObjectId, destinationObjectId);
    }

    /**
     * @access private
     */
    testYandexAPIConnection() {
        // console.log(this.token);
        let res = axios.get("https://api.rasp.yandex.net/v3.0/copyright/", {
            params: {
                apikey: this.token,
                format: "json"
            }
        });
        return res;
    }
}

module.exports.YandexTrainsAPI = YandexTrainsAPI;
