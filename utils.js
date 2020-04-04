const { DateTime } = require('luxon');

class Utils {
    static currentMskDateTime() {
        return DateTime.local().setZone("Europe/Moscow");
    }

    static currentMskDate() {
        return Utils.currentMskDateTime().toISO().slice(0, 10);
    }

    static defaultDate() {
        return Utils.currentMskDate();
    }

    /**
     * @param {string} dt - Datetime string in ISO format
     */
    static getTimeDifferenceFromNow(dt) {
        return DateTime.fromISO(dt).toMillis() - Date.now();
    }

    static binarySearchPositiveMinIdx(array, estimatorFunc) {
        let startIdx = 0;
        let endIdx = array.length - 1;
        let min = -1;
        let idx;

        while (startIdx <= endIdx) {
            idx = Math.floor((startIdx + endIdx) / 2);
            if (estimatorFunc(array[idx]) < 0) {
                startIdx = idx + 1;
            }
            else {
                min = idx;
                endIdx = idx - 1;
            }

        }

        return min;
    }

}

module.exports = Utils;
