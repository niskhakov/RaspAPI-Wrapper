const AWS = require("aws-sdk");

AWS.config.update({
  region: "eu-central-1",
});

const config = {
  TableName: "TrainsSchedule",
  "Date": "Date",
  FromTo: "FromTo",
  Payload: "Payload",
};



class Storage {
  constructor() {
    this.doc = new AWS.DynamoDB.DocumentClient();
  }

  write(date, fromId, toId, payload) {
    const params = {
      TableName: config.TableName,
      Item: {
        [config.Date]: date,
        [config.FromTo]: `${fromId}:${toId}`,
        [config.Payload]: payload,
      },
    };

    return this.promisify(params, this.doc.put);
  }

  get(date, fromId, toId) {
    const params = {
      TableName: config.TableName,
      Key: {
        [config.Date]: date,
        [config.FromTo]: `${fromId}:${toId}`
      }
    }

    return this.promisify(params, this.doc.get);
  }

  delete(date, fromId, toId) {
    const params = {
      TableName: config.TableName,
      Key: {
        [config.Date]: date,
        [config.FromTo]: `${fromId}:${toId}`
      }
    }
    return this.promisify(params, this.doc.delete);
  }

  test() {
    console.log("test")
  }

  promisify(params, awsfunc) {
    return new Promise((resolve, reject) => {
      awsfunc = awsfunc.bind(this.doc);
      let res = awsfunc(params, (err, data) => {
        if (err) {
          // console.log("Error: ", err, res);
          reject(err);
        }
        else {
          // console.log("Success: ", data, res);
          resolve(data);
        }
      })
    })
  }
}

module.exports.Storage = Storage;
