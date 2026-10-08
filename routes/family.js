const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

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
CONFIG
=========================================================
Family limit:
1 Admin + 10 Members = maximum 11 active members
*/
const MAX_FAMILY_MEMBERS = 11;


/*
=========================================================
AUTH
=========================================================
*/

function getUserId(req) {
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
        throw new Error("Authentication required");
    }

    const token = auth.substring(7).trim();

    if (!token) {
        throw new Error("Authentication required");
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.id) {
        throw new Error("Invalid authentication token");
    }

    return decoded.id;
}


/*
=========================================================
AUTH ERROR HELPER
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
GET CURRENT FAMILY MEMBERSHIP
=========================================================
*/

async function getCurrentMembership(userId) {
    const { data, error } = await supabase
        .from("family_members")
        .select(
            "id, user_id, family_id, name, role, is_active"
        )
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
FAMILY LINK CODE HELPERS
=========================================================
*/

const FAMILY_CODE_TTL_MINUTES = 10;

function generateFamilyLinkCode() {
    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let raw = "";

    const randomBytes =
        crypto.randomBytes(8);

    for (let i = 0; i < 8; i++) {
        raw +=
            alphabet[
                randomBytes[i] %
                alphabet.length
            ];
    }

    return `SAM-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}


function hashFamilyLinkCode(code) {
    return crypto
        .createHash("sha256")
        .update(
            String(code)
                .trim()
                .toUpperCase()
        )
        .digest("hex");
}
/*
=========================================================
CREATE FAMILY FOR FIRST-TIME USER
=========================================================
*/

async function createFamilyForUser(userId) {

    /*
    Double-check:
    User may already have a family membership.
    */
    const existing =
        await getCurrentMembership(userId);

    if (existing?.family_id) {
        return existing;
    }


    /*
    Get user's name/email for a useful default family name.
    */
    let familyName = "My Family";

    const { data: userData } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", userId)
        .maybeSingle();

    if (userData?.name) {
        familyName =
            `${String(userData.name).trim()}'s Family`;
    }


    /*
    Create family.
    */
    const { data: family, error: familyError } =
        await supabase
            .from("families")
            .insert([
                {
                    name: familyName,
                    created_by: userId
                }
            ])
            .select()
            .single();

    if (familyError) {
        throw familyError;
    }


    /*
    Create admin membership.
    */
    const { data: adminMember, error: memberError } =
        await supabase
            .from("family_members")
            .insert([
                {
                    user_id: userId,
                    family_id: family.id,
                    name:
                        userData?.name ||
                        "Family Admin",
                    phone: null,
                    location: null,
                    relation: "admin",
                    role: "admin",
                    is_active: true,
                    last_updated:
                        new Date().toISOString()
                }
            ])
            .select()
            .single();

    if (memberError) {
        /*
        Do NOT silently leave an unusable family.
        Return the real database error.
        */
        console.error(
            "Admin membership creation error:",
            memberError
        );

        throw memberError;
    }

    return adminMember;
}


/*
=========================================================
GET /api/family
=========================================================
*/

router.get("/", async (req, res) => {

    try {

        const userId = getUserId(req);

        let membership =
            await getCurrentMembership(userId);


      /*
First-time user:

For normal Family page requests,
automatically create their family.

For the account-linking flow,
?noCreate=true prevents automatic
family creation so the user can
join another family's account.
*/

const preventAutoCreate =
    String(req.query.noCreate || "")
        .toLowerCase() === "true";

if (
    !membership?.family_id &&
    preventAutoCreate
) {

    return res.json({
        family: null,
        members: [],
        currentUserRole: null
    });
}

if (!membership?.family_id) {

    membership =
        await createFamilyForUser(userId);
} 

        /*
        Get family.
        */
        const {
            data: family,
            error: familyError
        } = await supabase
            .from("families")
            .select(
                "id, name, created_by, created_at"
            )
            .eq(
                "id",
                membership.family_id
            )
            .maybeSingle();

        if (familyError) {
            throw familyError;
        }


        if (!family) {
            return res.status(404).json({
                error: "Family not found"
            });
        }


        /*
        Get active members.
        */
        const {
            data: members,
            error: membersError
        } = await supabase
            .from("family_members")
            .select(
                "id, user_id, family_id, name, phone, location, last_updated, created_at, relation, role, is_active"
            )
            .eq(
                "family_id",
                membership.family_id
            )
            .eq(
                "is_active",
                true
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

        if (membersError) {
            throw membersError;
        }


        return res.json({
            family,
            members: members || [],
            currentUserRole:
                membership.role || "member"
        });

    } catch (err) {

        console.error(
            "Family fetch error:",
            err
        );

        if (isAuthError(err)) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        return res.status(500).json({
            error:
                "Could not fetch family members"
        });
    }
});


/*
=========================================================
POST /api/family
ADD FAMILY MEMBER
=========================================================
*/

router.post("/", async (req, res) => {

    try {

        const userId = getUserId(req);

        const {
            name,
            phone = null,
            location = null,
            relation = null
        } = req.body || {};


        /*
        Validate name.
        */
        if (
            !name ||
            !String(name).trim()
        ) {
            return res.status(400).json({
                error: "Name is required"
            });
        }


        /*
        Get current membership.
        */
        let currentMember =
            await getCurrentMembership(userId);


        /*
        If first-time user somehow reaches POST
        before GET, create family here too.
        */
        if (!currentMember?.family_id) {

            currentMember =
                await createFamilyForUser(userId);
        }


        /*
        Only admin can add.
        */
        if (currentMember.role !== "admin") {
            return res.status(403).json({
                error:
                    "Only family admin can add members"
            });
        }


        /*
        Count active members.
        */
        const {
            count,
            error: countError
        } = await supabase
            .from("family_members")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "family_id",
                currentMember.family_id
            )
            .eq(
                "is_active",
                true
            );

        if (countError) {
            throw countError;
        }


        /*
        Maximum:
        1 admin + 10 members
        */
        if (
            Number(count || 0) >=
            MAX_FAMILY_MEMBERS
        ) {
            return res.status(400).json({
                error:
                    "Family limit reached. Maximum 10 family members can be added besides the admin."
            });
        }


        /*
        IMPORTANT:
        Do NOT assign admin's user_id to
        another family member.

        A member who does not have a SamarthAI
        account yet gets user_id = null.

        When that person creates/joins an account,
        account linking can be implemented separately.
        */
        const memberData = {
            user_id: null,
            family_id:
                currentMember.family_id,
            name:
                String(name).trim(),
            phone:
                phone
                    ? String(phone).trim()
                    : null,
            location:
                location
                    ? String(location).trim()
                    : null,
            relation:
                relation
                    ? String(relation).trim()
                    : null,
            role: "member",
            is_active: true,
            last_updated:
                new Date().toISOString()
        };


        const {
            data,
            error
        } = await supabase
            .from("family_members")
            .insert([
                memberData
            ])
            .select()
            .single();

        if (error) {
            throw error;
        }


        return res.status(201).json({
            message:
                "Family member added successfully",
            member: data
        });

    } catch (err) {

        console.error(
            "Family insert error:",
            err
        );

        if (isAuthError(err)) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        return res.status(500).json({
            error:
                "Could not add family member"
        });
    }
});

/*
=========================================================
POST /api/family/link-code
GENERATE FAMILY LINK CODE
=========================================================
*/

router.post(
    "/link-code",
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

      let currentMember =
    await getCurrentMembership(
        userId
    );

/*
First-time account can create
its own family when generating
a family link code.
*/

if (!currentMember?.family_id) {

    currentMember =
        await createFamilyForUser(
            userId
        );
}

if (
    currentMember.role !==
    "admin"
) {
                return res.status(403).json({
                    error:
                        "Only family admin can generate a family code"
                });
            }


            /*
            Check family capacity.
            */

            const {
                count,
                error: countError
            } = await supabase
                .from("family_members")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "family_id",
                    currentMember.family_id
                )
                .eq(
                    "is_active",
                    true
                );

            if (countError) {
                throw countError;
            }

            if (
                Number(count || 0) >=
                MAX_FAMILY_MEMBERS
            ) {
                return res.status(400).json({
                    error:
                        "Family limit reached. Maximum 11 active members are allowed."
                });
            }


            /*
            Invalidate previous unused codes
            for this family.
            */

            await supabase
                .from("family_link_codes")
                .update({
                    used_at:
                        new Date().toISOString()
                })
                .eq(
                    "family_id",
                    currentMember.family_id
                )
                .is(
                    "used_at",
                    null
                );


            /*
            Generate new code.
            */

            const code =
                generateFamilyLinkCode();

            const codeHash =
                hashFamilyLinkCode(code);

            const expiresAt =
                new Date(
                    Date.now() +
                    FAMILY_CODE_TTL_MINUTES *
                    60 *
                    1000
                ).toISOString();


            const {
                error: insertError
            } = await supabase
                .from("family_link_codes")
                .insert([
                    {
                        family_id:
                            currentMember.family_id,

                        created_by:
                            userId,

                        code_hash:
                            codeHash,

                        expires_at:
                            expiresAt
                    }
                ]);

            if (insertError) {
                throw insertError;
            }


            return res.status(201).json({
                message:
                    "Family link code generated successfully",

                code,

                expiresAt,

                expiresInMinutes:
                    FAMILY_CODE_TTL_MINUTES
            });

        } catch (err) {

            console.error(
                "Family link code generation error:",
                err
            );

            if (isAuthError(err)) {
                return res.status(401).json({
                    error:
                        "Unauthorized"
                });
            }

            return res.status(500).json({
                error:
                    "Could not generate family link code"
            });
        }
    }
);
/*
=========================================================
POST /api/family/join
JOIN FAMILY USING CODE
=========================================================
*/

router.post(
    "/join",
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

            const {
                code,
                relation = null
            } = req.body || {};

            if (
                !code ||
                !String(code).trim()
            ) {
                return res.status(400).json({
                    error:
                        "Family code is required"
                });
            }

            /*
            Current user must not already
            belong to an active family.
            */

            const existingMembership =
                await getCurrentMembership(
                    userId
                );

            if (
                existingMembership?.family_id
            ) {
                return res.status(400).json({
                    error:
                        "You are already a member of a family"
                });
            }

            /*
            Normalize and hash code.
            */

            const normalizedCode =
                String(code)
                    .trim()
                    .toUpperCase();

            const codeHash =
                hashFamilyLinkCode(
                    normalizedCode
                );

            /*
            Find valid unused code.
            */

            const {
                data: linkCode,
                error: codeError
            } = await supabase
                .from("family_link_codes")
                .select(
                    "id, family_id, created_by, expires_at, used_at"
                )
                .eq(
                    "code_hash",
                    codeHash
                )
                .is(
                    "used_at",
                    null
                )
                .gt(
                    "expires_at",
                    new Date().toISOString()
                )
                .maybeSingle();

            if (codeError) {
                throw codeError;
            }

            if (!linkCode) {
                return res.status(400).json({
                    error:
                        "Invalid or expired family code"
                });
            }

            /*
            Check family capacity again.
            */

            const {
                count,
                error: countError
            } = await supabase
                .from("family_members")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "family_id",
                    linkCode.family_id
                )
                .eq(
                    "is_active",
                    true
                );

            if (countError) {
                throw countError;
            }

            if (
                Number(count || 0) >=
                MAX_FAMILY_MEMBERS
            ) {
                return res.status(400).json({
                    error:
                        "This family has reached its maximum member limit"
                });
            }

            /*
            Prevent admin from joining
            their own family.
            */

            if (
                linkCode.created_by ===
                userId
            ) {
                return res.status(400).json({
                    error:
                        "Family admin cannot join their own family using this code"
                });
            }

            /*
            Get joining user's profile.
            */

            const {
                data: userData,
                error: userError
            } = await supabase
                .from("users")
                .select(
                    "id, name, phone"
                )
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();

            if (userError) {
                throw userError;
            }

            if (!userData) {
                return res.status(404).json({
                    error:
                        "User account not found"
                });
            }

            /*
            Create linked family membership.
            */

            const memberData = {

                user_id:
                    userId,

                family_id:
                    linkCode.family_id,

                name:
                    userData.name ||
                    "Family Member",

                phone:
                    userData.phone ||
                    null,

                location:
                    null,

                relation:
                    relation
                        ? String(relation).trim()
                        : null,

                role:
                    "member",

                is_active:
                    true,

                last_updated:
                    new Date().toISOString()
            };

            const {
                data: member,
                error: memberError
            } = await supabase
                .from("family_members")
                .insert([
                    memberData
                ])
                .select()
                .single();

            if (memberError) {
                throw memberError;
            }

            /*
            Consume the code immediately.
            */

            const {
                error: consumeError
            } = await supabase
                .from("family_link_codes")
                .update({
                    used_at:
                        new Date().toISOString(),

                    used_by:
                        userId
                })
                .eq(
                    "id",
                    linkCode.id
                )
                .is(
                    "used_at",
                    null
                );

            if (consumeError) {

                console.error(
                    "Family code consume error:",
                    consumeError
                );
            }

            return res.status(201).json({
                message:
                    "Successfully joined family",

                member: {
                    id:
                        member.id,

                    family_id:
                        member.family_id,

                    name:
                        member.name,

                    role:
                        member.role,

                    relation:
                        member.relation
                }
            });

        } catch (err) {

            console.error(
                "Family join error:",
                err
            );

            if (isAuthError(err)) {
                return res.status(401).json({
                    error:
                        "Unauthorized"
                });
            }

            return res.status(500).json({
                error:
                    "Could not join family"
            });
        }
    }
);
/*
=========================================================
GET /api/family/:memberId/gps
=========================================================
*/

router.get(
    "/:memberId/gps",
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

            const memberId =
                req.params.memberId;


            const currentMember =
                await getCurrentMembership(
                    userId
                );


            if (
                !currentMember?.family_id
            ) {
                return res.status(403).json({
                    error:
                        "Family access denied"
                });
            }


            /*
            Target must belong to same family.
            */
            const {
                data: member,
                error
            } = await supabase
                .from("family_members")
                .select(
                    "id, name, location, last_updated"
                )
                .eq(
                    "id",
                    memberId
                )
                .eq(
                    "family_id",
                    currentMember.family_id
                )
                .eq(
                    "is_active",
                    true
                )
                .maybeSingle();


            if (error) {
                throw error;
            }


            if (!member) {
                return res.status(404).json({
                    error:
                        "Family member not found"
                });
            }


            return res.json({
                memberId:
                    member.id,
                name:
                    member.name,
                location:
                    member.location,
                last_updated:
                    member.last_updated
            });

        } catch (err) {

            console.error(
                "Family GPS error:",
                err
            );

            if (isAuthError(err)) {
                return res.status(401).json({
                    error: "Unauthorized"
                });
            }

            return res.status(500).json({
                error:
                    "Could not fetch GPS location"
            });
        }
    }
);


/*
=========================================================
POST /api/family/:memberId/sos
=========================================================
*/

router.post(
    "/:memberId/sos",
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

            const memberId =
                req.params.memberId;

            const {
                location = null
            } = req.body || {};


            const currentMember =
                await getCurrentMembership(
                    userId
                );


            if (
                !currentMember?.family_id
            ) {
                return res.status(403).json({
                    error:
                        "Family access denied"
                });
            }


            /*
            Verify target member belongs
            to the same family.
            */
            const {
                data: targetMember,
                error: targetError
            } = await supabase
                .from("family_members")
                .select(
                    "id, name, user_id"
                )
                .eq(
                    "id",
                    memberId
                )
                .eq(
                    "family_id",
                    currentMember.family_id
                )
                .eq(
                    "is_active",
                    true
                )
                .maybeSingle();


            if (targetError) {
                throw targetError;
            }


            if (!targetMember) {
                return res.status(404).json({
                    error:
                        "Family member not found"
                });
            }


            /*
            For a member without an account,
            use the requesting user's ID so
            sos_alerts.user_id remains valid.
            */
            const sosUserId =
                targetMember.user_id ||
                userId;


            const {
                data: sos,
                error: sosError
            } = await supabase
                .from("sos_alerts")
                .insert([
                    {
                        user_id:
                            sosUserId,
                        location:
                            location,
                        contacts: [],
                        status:
                            "active"
                    }
                ])
                .select()
                .single();


            if (sosError) {
                throw sosError;
            }


            return res.status(201).json({
                message:
                    `SOS alert triggered for ${targetMember.name}`,
                alert: sos
            });

        } catch (err) {

            console.error(
                "Family SOS error:",
                err
            );

            if (isAuthError(err)) {
                return res.status(401).json({
                    error: "Unauthorized"
                });
            }

            return res.status(500).json({
                error:
                    "Could not trigger SOS alert"
            });
        }
    }
);


/*
=========================================================
DELETE /api/family/:memberId
SOFT DELETE
=========================================================
*/

router.delete(
    "/:memberId",
    async (req, res) => {

        try {

            const userId =
                getUserId(req);

            const memberId =
                req.params.memberId;


            const currentMember =
                await getCurrentMembership(
                    userId
                );


            if (
                !currentMember?.family_id
            ) {
                return res.status(403).json({
                    error:
                        "Family access denied"
                });
            }


            if (
                currentMember.role !==
                "admin"
            ) {
                return res.status(403).json({
                    error:
                        "Only family admin can remove members"
                });
            }


            /*
            Find target in same family.
            */
            const {
                data: targetMember,
                error: targetError
            } = await supabase
                .from("family_members")
                .select(
                    "id, role, user_id"
                )
                .eq(
                    "id",
                    memberId
                )
                .eq(
                    "family_id",
                    currentMember.family_id
                )
                .eq(
                    "is_active",
                    true
                )
                .maybeSingle();


            if (targetError) {
                throw targetError;
            }


            if (!targetMember) {
                return res.status(404).json({
                    error:
                        "Family member not found"
                });
            }


            /*
            Admin cannot remove admin.
            */
            if (
                targetMember.role ===
                "admin"
            ) {
                return res.status(400).json({
                    error:
                        "Family admin cannot be removed"
                });
            }


            /*
            Soft delete only.
            */
            const {
                error: updateError
            } = await supabase
                .from("family_members")
                .update({
                    is_active: false,
                    last_updated:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    memberId
                )
                .eq(
                    "family_id",
                    currentMember.family_id
                );


            if (updateError) {
                throw updateError;
            }


            return res.json({
                message:
                    "Family member removed successfully"
            });

        } catch (err) {

            console.error(
                "Family delete error:",
                err
            );

            if (isAuthError(err)) {
                return res.status(401).json({
                    error: "Unauthorized"
                });
            }

            return res.status(500).json({
                error:
                    "Could not remove family member"
            });
        }
    }
);


module.exports = router;
