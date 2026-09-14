const geoip = require("geoip-lite");
const crypto = require("crypto");

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];

    console.log("X-Forwarded-For:", forwarded);
    console.log("Remote Address:", req.socket?.remoteAddress);
    console.log("Request IP:", req.ip);

    if (forwarded) {
        const ip = forwarded.split(",")[0].trim();
        console.log("Selected Forwarded IP:", ip);
        return ip;
    }

    const ip = req.socket?.remoteAddress || req.ip || "";

    console.log("Selected IP:", ip);

    return ip;
}

function hashIp(ip) {
    if (!ip) {
        console.log("IP hash skipped: empty IP");
        return null;
    }

    const hash = crypto.createHash("sha256").update(ip).digest("hex");

    console.log("IP Hash:", hash);

    return hash;
}

function getLocation(ip) {
    console.log("GeoIP input IP:", ip);

    if (!ip) {
        console.log("GeoIP: IP is empty");

        return {
            country: "Unknown",
            region: "Unknown",
            city: "Unknown",
        };
    }

    if (ip.startsWith("::ffff:")) {
        ip = ip.replace("::ffff:", "");
        console.log("Converted IPv4:", ip);
    }

    const geo = geoip.lookup(ip);

    console.log("GeoIP result:", geo);

    if (!geo) {
        console.log("GeoIP: No location found for IP:", ip);

        return {
            country: "Unknown",
            region: "Unknown",
            city: "Unknown",
        };
    }

    const location = {
        country: geo.country || "Unknown",
        region: geo.region || "Unknown",
        city: geo.city || "Unknown",
    };

    console.log("Final Location:", location);

    return location;
}

module.exports = {
    getClientIp,
    hashIp,
    getLocation,
};
