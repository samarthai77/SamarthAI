const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}


/*
=========================================================
SOS RATE LIMIT
=========================================================
Maximum 3 SOS requests per IP in 60 seconds.

This is an additional abuse-protection layer.
The actual emergency request is still authenticated
through JWT.
=========================================================
*/

const sosRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many SOS requests. Please wait before trying again."
    }
});


/*
=========================================================
AUTH
=========================================================
*/

function getUserId(req) {

    const auth =
        req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
        throw new Error("Authentication required");
    }

    const token =
        auth.substring(7).trim();

    if (!token) {
        throw new Error("Authentication required");
    }

    const decoded =
        jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.id) {
        throw new Error("Invalid authentication token");
    }

    return decoded.id;
}


/*
=========================================================
AUTH ERROR CHECK
=========================================================
*/

function isAuthError(err) {

    return (
        err?.name === "JsonWebTokenError" ||
        err?.name === "TokenExpiredError" ||
        err?.message === "Authentication required" ||
        err?.message === "Invalid authentication token"
    );
}


/*
=========================================================
VALIDATE COORDINATES
=========================================================
*/

function isValidCoordinate(latitude, longitude) {

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return false;
    }

    if (lat < -90 || lat > 90) {
        return false;
    }

    if (lon < -180 || lon > 180) {
        return false;
    }

    return true;
}


/*
=========================================================
GET CURRENT FAMILY MEMBERSHIP
=========================================================
*/

async function getCurrentMembership(userId) {

    const {
        data,
        error
    } = await supabase
        .from("family_members")
        .select(`
            id,
            user_id,
            family_id,
            name,
            phone,
            relation,
            role,
            is_active
        `)
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", {
            ascending: true
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


/*
=========================================================
GET USER INFORMATION
=========================================================
*/

async function getUserInfo(userId) {

    const {
        data,
        error
    } = await supabase
        .from("users")
        .select("id, name, phone")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


/*
=========================================================
GET FAMILY SOS CONTACTS
=========================================================
IMPORTANT:
The client cannot control SOS contacts.

Contacts are derived from the server-side family
membership.
=========================================================
*/

async function getFamilyContacts(
    familyId,
    currentUserId
) {

    const {
        data: members,
        error: membersError
    } = await supabase
        .from("family_members")
        .select(`
            id,
            user_id,
            name,
            phone,
            role,
            is_active
        `)
        .eq("family_id", familyId)
        .eq("is_active", true);

    if (membersError) {
        throw membersError;
    }

    if (!Array.isArray(members)) {
        return [];
    }

    const accountUserIds = members
        .filter(member =>
            member.user_id &&
            member.user_id !== currentUserId
        )
        .map(member => member.user_id);

    let userPhones = {};

    if (accountUserIds.length > 0) {

        const {
            data: users,
            error: usersError
        } = await supabase
            .from("users")
            .select("id, phone")
            .in("id", accountUserIds);

        if (usersError) {
            throw usersError;
        }

        if (Array.isArray(users)) {
            for (const user of users) {
                if (user.phone) {
                    userPhones[user.id] =
                        String(user.phone).trim();
                }
            }
        }
    }

    const contacts = [];

    for (const member of members) {

        /*
        Do not add the SOS sender as a contact.
        */

        if (
            member.user_id &&
            member.user_id === currentUserId
        ) {
            continue;
        }

        let phone = null;

        /*
        First preference:
        family_members.phone
        */

        if (member.phone) {
            phone = String(member.phone).trim();
        }

        /*
        Second preference:
        linked user's phone
        */

        if (
            !phone &&
            member.user_id &&
            userPhones[member.user_id]
        ) {
            phone = userPhones[member.user_id];
        }

        if (phone) {
            contacts.push(phone);
        }
    }

    /*
    Remove duplicates.
    */

    return [...new Set(contacts)];
}


/*
=========================================================
CREATE SOS
POST /api/sos
=========================================================
*/

router.post(
    "/",
    sosRateLimit,
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

            const {
                latitude,
                longitude
            } = req.body || {};


            /*
            GPS is required.
            */

            if (
                !isValidCoordinate(
                    latitude,
                    longitude
                )
            ) {
                return res.status(400).json({
                    error:
                        "Valid GPS latitude and longitude are required"
                });
            }


            const lat =
                Number(latitude);

            const lon =
                Number(longitude);


            /*
            Get current family membership.
            */

            const membership =
                await getCurrentMembership(
                    userId
                );


            if (!membership?.family_id) {

                return res.status(403).json({
                    error:
                        "Family setup is required before using SOS"
                });
            }


            /*
            Get sender information.
            */

            const user =
                await getUserInfo(userId);


            const senderName =
                user?.name ||
                membership.name ||
                "SamarthAI user";


            /*
            Server-controlled family contacts.
            */

            const contacts =
                await getFamilyContacts(
                    membership.family_id,
                    userId
                );


            /*
            Store coordinates in the existing
            location text column.

            Example:
            "25.4358, 81.8463"
            */

            const location =
                `${lat.toFixed(6)}, ${lon.toFixed(6)}`;


            /*
            Create SOS record.
            */

            const {
                data: sos,
                error: sosError
            } = await supabase
                .from("sos_alerts")
                .insert([
                    {
                        user_id: userId,
                        location,
                        contacts,
                        status: "active"
                    }
                ])
                .select()
                .single();


            if (sosError) {
                throw sosError;
            }


            /*
            Update current family member's location.

            This keeps the latest emergency position
            available to Family/GPS.
            */

            const {
                error: locationError
            } = await supabase
                .from("family_members")
                .update({
                    location,
                    last_updated:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    membership.id
                )
                .eq(
                    "family_id",
                    membership.family_id
                )
                .eq(
                    "is_active",
                    true
                );

            if (locationError) {
                console.error(
                    "SOS location update error:",
                    locationError
                );
            }


            /*
            Get all active family members.
            */

            const {
                data: familyMembers,
                error: membersError
            } = await supabase
                .from("family_members")
                .select(
                    "id, user_id, name"
                )
                .eq(
                    "family_id",
                    membership.family_id
                )
                .eq(
                    "is_active",
                    true
                );


            if (membersError) {
                console.error(
                    "Family members lookup error:",
                    membersError
                );
            }


            /*
            Create in-app alerts for all
            other active family members.
            */

            if (
                Array.isArray(familyMembers)
            ) {

                const alerts =
                    familyMembers
                        .filter(
                            member =>
                                member.id !==
                                membership.id
                        )
                        .map(
                            member => ({
                                member_id:
                                    member.id,

                                alert_type:
                                    "sos",

                                message:
                                    `🚨 SOS emergency alert from ${senderName}`,

                                sos_id:
                                    sos.id,

                                is_read:
                                    false
                            })
                        );


                if (alerts.length > 0) {

                    const {
                        error: alertError
                    } = await supabase
                        .from("alerts")
                        .insert(alerts);

                    if (alertError) {

                        /*
                        SOS itself already exists.
                        Do not convert a successful SOS
                        into a failed request just because
                        in-app alerts failed.
                        */

                        console.error(
                            "SOS family alert error:",
                            alertError
                        );
                    }
                }
            }


            /*
            Successful response.
            */

            return res.status(201).json({

                message:
                    "SOS alert created successfully",

                sos: {
                    id: sos.id,
                    location: sos.location,
                    status: sos.status,
                    created_at:
                        sos.created_at
                },

                familyContacts:
                    contacts.length,

                familyAlert:
                    true
            });

        } catch (error) {

            console.error(
                "❌ Create SOS error:",
                error
            );


            if (isAuthError(error)) {

                return res.status(401).json({
                    error: "Unauthorized"
                });
            }


            return res.status(500).json({
                error:
                    "Could not create SOS alert"
            });
        }
    }
);


/*
=========================================================
GET SOS ALERTS
GET /api/sos
=========================================================
*/

router.get(
    "/",
    async (req, res) => {

        try {

            const userId =
                getUserId(req);


            const {
                data: sosAlerts,
                error
            } = await supabase
                .from("sos_alerts")
                .select("*")
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


            if (error) {
                throw error;
            }


            return res.json(
                sosAlerts || []
            );

        } catch (error) {

            console.error(
                "❌ Get SOS error:",
                error
            );


            if (isAuthError(error)) {

                return res.status(401).json({
                    error: "Unauthorized"
                });
            }


            return res.status(500).json({
                error:
                    "Could not fetch SOS alerts"
            });
        }
    }
);


module.exports = router;
