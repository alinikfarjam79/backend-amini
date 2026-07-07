const IRAN_MOBILE_REGEX = /^(?:\+98|0098|98|0)?9\d{9}$/;

const normalizeIranPhoneNumber = (phoneNumber) => {
  if (typeof phoneNumber !== "string") {
    return phoneNumber;
  }

  let normalized = phoneNumber.trim().replace(/\s|-/g, "");

  if (normalized.startsWith("0098")) {
    normalized = `0${normalized.slice(4)}`;
  } else if (normalized.startsWith("+98")) {
    normalized = `0${normalized.slice(3)}`;
  } else if (normalized.startsWith("98")) {
    normalized = `0${normalized.slice(2)}`;
  } else if (normalized.startsWith("9")) {
    normalized = `0${normalized}`;
  }

  return normalized;
};

module.exports = {
  IRAN_MOBILE_REGEX,
  normalizeIranPhoneNumber,
};
