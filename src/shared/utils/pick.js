const pick = (object, keys) => {
    const result = {};

    keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            result[key] = object[key];
        }
    });

    return result;
};

module.exports = pick;