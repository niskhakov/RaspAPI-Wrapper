require("dotenv").config();


const assert = require('chai').assert
const { YandexTrainsAPI } = require("../yandexapi.js");
const fs = require("fs");

const token = process.env.YANDEXTOKEN;

const api = new YandexTrainsAPI(token);

const testItem = {
    date: "0000-00-00",
}

describe('YandexAPI', function() {
    this.timeout(5000);

    it('get station hint', async() => {
        let res = api.getHint("павел");
        // console.log(res);
        assert.ok(res.length === 1);
    });

    it('get station hint of abrakadabra and return empty array', () => {
        let res = api.getHint("абракадабра");
        assert.ok(res.length === 0)
    })

    it("get schedule", async() => {
        let res = await api.getSchedule("тимирязевская", "новодачная", { schedule_items: 2 });
        assert.lengthOf(res, 2);
    })

    it("get schedule (with cache predeleted)", async() => {
        const depObj = api.getStationObject("тимирязевская");
        const destObj = api.getStationObject("новодачная");
        await api.deleteScheduleFromCache(depObj.id, destObj.id)
        let res = await api.getSchedule("тимирязевская", "новодачная", { schedule_items: 2 });
        assert.lengthOf(res, 2);
    })

    it("get schedule by id", async() => {
        const depId = "s9601830";
        const destId = "s9602463";
        let res = await api.getScheduleByID(depId, destId);
        assert.lengthOf(res, 1);
    })

    it("get schedule of train between stations where path does not exist", async() => {
        let res = await api.getSchedule("тимирязевская", "окружная, мцк");
        assert.lengthOf(res, 0)
    })


    it("(private) connect to yandex api", async() => {
        let res = await api.testYandexAPIConnection();
        return res;
    })


    it("(private) fetch cached stations and cached length is greater than 100 (should be around 500 stations)", function() {
        let api = new YandexTrainsAPI(token);
        api.fetchCachedStations();
        let count = Object.keys(api.stationsMap).length;
        assert.ok(count > 100);
    })

    it("(private) get station object by station name - ex. Timiryazevskaya", () => {
        let stationObj = api.getStationObject("тимирязевская");
        const expected = {
            stationName: 'Тимирязевская',
            direction: 'Савёловское',
            id: 's9602463'
        }
        assert.deepEqual(stationObj, expected);
    })

    it("(private) request schedule page from YandexAPI", async() => {
        const tmrzv = api.getStationObject("тимирязевская");
        assert.deepEqual(tmrzv, {
            stationName: 'Тимирязевская',
            direction: 'Савёловское',
            id: 's9602463'
        });

        const nvdch = api.getStationObject("новодачная");
        assert.deepEqual(nvdch, {
            stationName: 'Новодачная',
            direction: 'Савёловское',
            id: 's9601261'
        });

        let res = await api.requestSchedulePageFromYandexAPI(nvdch.id, tmrzv.id, { offset: 100 });
        // let fsp = fs.promises.writeFile("tmp-axios-yandex2.json", JSON.stringify(res.data, null, 2));
        assert.ok(res.data)
    })

    it("(private) request entire schedule of trains between certain stations - request multiple pages", async() => {
        const tmrzv = api.getStationObject("тимирязевская");
        assert.deepEqual(tmrzv, {
            stationName: 'Тимирязевская',
            direction: 'Савёловское',
            id: 's9602463'
        });

        const nvdch = api.getStationObject("новодачная");
        assert.deepEqual(nvdch, {
            stationName: 'Новодачная',
            direction: 'Савёловское',
            id: 's9601261'
        });

        let res = await api.requestEntireScheduleFromYandexAPI(nvdch.id, tmrzv.id);
        // let fsp = fs.promises.writeFile("tmp-simplified-schedule.json", JSON.stringify(res, null, 2));
        // return fsp;
        return res;
    })

    it("(private) request schedule (cache) is not empty", async() => {
        const depObj = api.getStationObject("тимирязевская");
        const destObj = api.getStationObject("новодачная");
        const res = await api.requestSchedule(depObj, destObj, { allow_api_query: false, date: testItem.date });
        assert.isNotEmpty(res);
    })

    it("(private) request schedule (api) is not empty", async() => {
        const depObj = api.getStationObject("тимирязевская");
        const destObj = api.getStationObject("новодачная");
        const res = await api.requestSchedule(depObj, destObj, { allow_database_query: false });
        assert.isNotEmpty(res);
    })

    it("(private) request nonexistent schedule (cache)", async() => {
        const depObj = { id: "test123781934731209" };
        const destObj = { id: "test1237819347312090" };
        let found = false;
        try {
            const res = await api.requestSchedule(depObj, destObj, { allow_api_query: false });
            found = true;
        }
        catch (err) {
            assert.equal(err.message, "API query not allowed");
        }
        if (found)
            throw new Error("Unexpected behavior: founded an nonexistent item in api")

    })

    it("(private) request nonexistent schedule (api)", async() => {
        const depObj = { id: "test123781934731209" };
        const destObj = { id: "test1237819347312090" };
        let found = false;
        try {
            const res = await api.requestSchedule(depObj, destObj, { allow_database_query: false });
            found = true;
        }
        catch (err) {
            assert.equal(err.message, "Request failed with status code 404")
        }
        if (found)
            throw new Error("Unexpected behavior: founded an nonexistent item in api")
    })

    it("(private) requestSchedule returns an empty array when undefined arguments are passed", async() => {
        const depObj = api.getStationObject("dsjfakdsjafkl;sajfasd;");
        const destObj = api.getStationObject("dsasfjfakdsjafkl;sajfasd;");
        const res = await api.requestSchedule(depObj, destObj);
        assert.isEmpty(res);
    })



});
