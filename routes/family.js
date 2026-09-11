const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || "samarthai_secret";

/* =========================================================
   AUTH
========================================================= */

function getUserId(req) {
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
        throw new Error("Authentication required");
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded?.id) {
        throw new Error("Invalid authentication token");
    }

    return decoded.id;
}


/* =========================================================
   GET FAMILY
   GET /api/family
========================================================= */

router.get("/", async (req, res) => {
    try {
        const userId = getUserId(req);

        // Find the active family membership of logged-in user
        const { data: membership, error: memberError } = await supabase
            .from("family_members")
            .select("family_id, role")
            .eq("user_id", userId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        if (memberError) throw memberError;

        if (!membership?.family_id) {
            return res.json({
                family: null,
                members: [],
                message: "You are not a member of any family yet."
            });
        }

        // Get family details
        const { data: family, error: familyError } = await supabase
            .from("families")
            .select("*")
            .eq("id", membership.family_id)
            .single();

        if (familyError) throw familyError;

        // Get family members
        const { data: members, error: membersError } = await supabase
            .from("family_members")
            .select(
                "id, user_id, family_id, name, phone, location, last_updated, created_at, relation, role, is_active"
            )
            .eq("family_id", membership.family_id)
            .eq("is_active", true)
            .order("created_at", { ascending: true });

        if (membersError) throw membersError;

        res.json({
            family,
            members: members || [],
            currentUserRole: membership.role
        });

    } catch (err) {
        console.error("Family fetch error:", err);

        if (
            err.name === "JsonWebTokenError" ||
            err.name === "TokenExpiredError" ||
            err.message === "Authentication required"
        ) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        res.status(500).json({
            error: "Could not fetch family members"
        });
    }
});


/* =========================================================
   ADD FAMILY MEMBER
   POST /api/family
========================================================= */

router.post("/", async (req, res) => {
    try {
        const userId = getUserId(req);

        const {
            name,
            phone,
            location = null,
            relation = null,
            role = "member"
        } = req.body || {};

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                error: "Name is required"
            });
        }

        // Find logged-in user's family
        const { data: currentMember, error: currentError } = await supabase
            .from("family_members")
            .select("family_id, role")
            .eq("user_id", userId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        if (currentError) throw currentError;

        if (!currentMember?.family_id) {
            return res.status(403).json({
                error: "You are not a member of any family"
            });
        }

        // Only family admin can add members
        if (currentMember.role !== "admin") {
            return res.status(403).json({
                error: "Only family admin can add members"
            });
        }

        // Do not allow arbitrary admin creation
        const safeRole = role === "admin" ? "member" : role;

        const { data, error } = await supabase
            .from("family_members")
            .insert([
                {
                    user_id: userId,
                    family_id: currentMember.family_id,
                    name: String(name).trim(),
                    phone: phone || null,
                    location: location || null,
                    relation: relation || null,
                    role: safeRole,
                    is_active: true,
                    last_updated: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            message: "Family member added successfully",
            member: data
        });

    } catch (err) {
        console.error("Family insert error:", err);

        if (
            err.name === "JsonWebTokenError" ||
            err.name === "TokenExpiredError" ||
            err.message === "Authentication required"
        ) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        res.status(500).json({
            error: "Could not add family member"
        });
    }
});


/* =========================================================
   GPS FOR FAMILY MEMBER
   GET /api/family/:memberId/gps
========================================================= */

router.get("/:memberId/gps", async (req, res) => {
    try {
        const userId = getUserId(req);
        const memberId = req.params.memberId;

        // Find current user's family
        const { data: currentMember, error: currentError } = await supabase
            .from("family_members")
            .select("family_id")
            .eq("user_id", userId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        if (currentError) throw currentError;

        if (!currentMember?.family_id) {
            return res.status(403).json({
                error: "Family access denied"
            });
        }

        // Only return member belonging to same family
        const { data: member, error } = await supabase
            .from("family_members")
            .select("id, name, location, last_updated")
            .eq("id", memberId)
            .eq("family_id", currentMember.family_id)
            .eq("is_active", true)
            .single();

        if (error) throw error;

        res.json({
            memberId: member.id,
            name: member.name,
            location: member.location,
            last_updated: member.last_updated
        });

    } catch (err) {
        console.error("Family GPS error:", err);

        if (
            err.name === "JsonWebTokenError" ||
            err.name === "TokenExpiredError" ||
            err.message === "Authentication required"
        ) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        res.status(500).json({
            error: "Could not fetch GPS location"
        });
    }
});


/* =========================================================
   SOS FOR FAMILY MEMBER
   POST /api/family/:memberId/sos
========================================================= */

router.post("/:memberId/sos", async (req, res) => {
    try {
        const userId = getUserId(req);
        const memberId = req.params.memberId;

        const {
            location = null
        } = req.body || {};

        // Find current user's family
        const { data: currentMember, error: currentError } = await supabase
            .from("family_members")
            .select("family_id")
            .eq("user_id", userId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        if (currentError) throw currentError;

        if (!currentMember?.family_id) {
            return res.status(403).json({
                error: "Family access denied"
            });
        }

        // Verify target member belongs to same family
        const { data: targetMember, error: targetError } = await supabase
            .from("family_members")
            .select("id, name, user_id")
            .eq("id", memberId)
            .eq("family_id", currentMember.family_id)
            .eq("is_active", true)
            .single();

        if (targetError) throw targetError;

        // Create SOS in the existing SOS table
        const { data: sos, error: sosError } = await supabase
            .from("sos_alerts")
            .insert([
                {
                    user_id: targetMember.user_id || userId,
                    location: location,
                    contacts: [],
                    status: "active"
                }
            ])
            .select()
            .single();

        if (sosError) throw sosError;

        res.status(201).json({
            message: `SOS alert triggered for ${targetMember.name}`,
            alert: sos
        });

    } catch (err) {
        console.error("Family SOS error:", err);

        if (
            err.name === "JsonWebTokenError" ||
            err.name === "TokenExpiredError" ||
            err.message === "Authentication required"
        ) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        res.status(500).json({
            error: "Could not trigger SOS alert"
        });
    }
});


/* =========================================================
   DELETE /api/family/:memberId
   Soft delete — database row physically delete nahi hoti
========================================================= */

router.delete("/:memberId", async (req, res) => {
    try {
        const userId = getUserId(req);
        const memberId = req.params.memberId;

        // Current user's family + role
        const { data: currentMember, error: currentError } = await supabase
            .from("family_members")
            .select("family_id, role")
            .eq("user_id", userId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        if (currentError) throw currentError;

        if (!currentMember?.family_id) {
            return res.status(403).json({
                error: "Family access denied"
            });
        }

        if (currentMember.role !== "admin") {
            return res.status(403).json({
                error: "Only family admin can remove members"
            });
        }

        // Do not remove the admin himself through this route
        const { data: targetMember, error: targetError } = await supabase
            .from("family_members")
            .select("id, role")
            .eq("id", memberId)
            .eq("family_id", currentMember.family_id)
            .single();

        if (targetError) throw targetError;

        if (targetMember.role === "admin") {
            return res.status(400).json({
                error: "Family admin cannot be removed"
            });
        }

        // Soft delete
        const { error: updateError } = await supabase
            .from("family_members")
            .update({
                is_active: false
            })
            .eq("id", memberId)
            .eq("family_id", currentMember.family_id);

        if (updateError) throw updateError;

        res.json({
            message: "Family member removed successfully"
        });

    } catch (err) {
        console.error("Family delete error:", err);

        if (
            err.name === "JsonWebTokenError" ||
            err.name === "TokenExpiredError" ||
            err.message === "Authentication required"
        ) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        res.status(500).json({
            error: "Could not remove family member"
        });
    }
});


module.exports = router;
