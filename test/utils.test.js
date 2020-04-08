const assert = require('chai').assert
const Utils = require("../utils.js");

describe('Utils', () => {
    it('get time difference from now must be negative if passing past time', () => {
        let dt = "2020-04-02T19:59:00+03:00";
        let res = Utils.getTimeDifferenceFromNow(dt);
        assert.isBelow(res, 0);
    });

    it('get time difference from now must be zero if passing currentTime', () => {
        let dt = new Date().toISOString();
        let res = Utils.getTimeDifferenceFromNow(dt);
        assert.ok(Math.abs(res) < 20);
    })

    it('get time difference from now must be positive if passing future time', () => {
        let dt = new Date();
        dt.setTime(dt.getTime() + 100000);
        let res = Utils.getTimeDifferenceFromNow(dt.toISOString());
        assert.isAbove(res, 0);
    })

    it('get current msk datetime is datetime object', () => {
        let mskdt = Utils.currentMskDateTime();
        let dt = new Date(mskdt.toISO());
        assert.ok(Math.abs(dt.getTime() - Date.now()) < 1000);
    })

    it('get current msk date have YYYY-MM-DD pattern', () => {
        let mskd = Utils.currentMskDate();
        assert.equal(mskd, Utils.currentMskDateTime().toISO().slice(0, 10))
        let s = mskd.split("-")
        assert.lengthOf(s, 3);
        assert.lengthOf(s[0], 4);
        assert.lengthOf(s[1], 2);
        assert.lengthOf(s[2], 2);
        s.forEach(item => {
            assert.ok(Array.from(item).every(ch => "0123456789".includes(ch)))
        })
    })

    it('currentDate has length of 10 and has pattern YYYY-MM-DD', () => {
        let ddt = Utils.defaultDate();
        assert.lengthOf(ddt, 10);
        let s = ddt.split("-")
        assert.lengthOf(s, 3);
        assert.lengthOf(s[0], 4);
        assert.lengthOf(s[1], 2);
        assert.lengthOf(s[2], 2);
        s.forEach(item => {
            assert.ok(Array.from(item).every(ch => "0123456789".includes(ch)))
        })
    })

    it(('binary search of min positive works correctly with numbers'), () => {
        let estimatorFunc = (item) => {
            return item;
        }

        let arr = [];
        for (let i = -160; i < 5; i++) {
            arr.push(i + 0.25);
        }

        let idx = Utils.binarySearchPositiveMinIdx(arr, estimatorFunc);

        assert.equal(idx, 160);
        assert.equal(arr[idx], 0.25);
    })

    it("binary search of min positive returns -1 on empty array", () => {
        let estimatorFunc = (item) => {
            return item;
        }
        let idx = Utils.binarySearchPositiveMinIdx([], estimatorFunc);
        assert.equal(idx, -1);
    })

})
