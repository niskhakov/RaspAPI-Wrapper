const assert = require("assert");
const { Storage } = require("../dynamodb.js");

const storage = new Storage();
const testItem = {
    "date": "2020-04-01",
    "from": "c00000001",
    "to": "c00000002",
    "payload": {
        "test": "info",
        "how": "are you"
    }
}

describe('DynamoDB', function() {
    it('put item to database', async() => {
        const { date, from, to, payload } = testItem;
        return storage.write(date, from, to, payload);
    });

    it('get (maybe empty) item from database', async() => {
        const { date, from, to, payload } = testItem;
        let res = await storage.get(date, from, to);
        return res;
    })

    it('get expected item with payload from database', async() => {
        const { date, from, to, payload } = testItem;
        const expected = {
            Item: {
                "Date": date,
                "FromTo": `${from}:${to}`,
                "Payload": payload
            }
        }

        let res = await storage.get(date, from, to);
        assert.deepEqual(res, expected);
    })

    it("delete item from database and recieves an empty object", async() => {
        const { date, from, to } = testItem;
        await storage.delete(date, from, to);
        let res = await storage.get(date, from, to);
        assert.deepEqual(res, {});
        return res;
    })


});
