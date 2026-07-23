'use server';
import { auth } from "@/lib/better-auth/auth";
import { inngest } from "../inngest/client";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { saveUserProfileOnSignUp } from "@/lib/actions/userProfile.actions";

export const signUpWithEmail = async ({ email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry }: SignUpFormData) => {
    try {
        const response = await auth.api.signUpEmail({
            body: { email, password, name: fullName }
        })

        if (response?.user?.id) {
            try {
                await connectToDatabase();
                await saveUserProfileOnSignUp({
                    userId: response.user.id,
                    country,
                    investmentGoals,
                    riskTolerance,
                    preferredIndustry,
                });
            } catch (profileErr) {
                console.warn('Profile save failed (non-blocking):', profileErr);
            }

            inngest.send({
                name: 'app/user.created',
                data: {
                    email,
                    name: fullName,
                    country,
                    investmentGoals,
                    riskTolerance,
                    preferredIndustry
                }
            }).catch((err) => {
                console.warn('Inngest event failed (non-blocking):', err.message);
            });
        }

        return { success: true, data: response }

    } catch (e) {
        console.log('Sign up failed', e)
        const message = e instanceof Error ? e.message : 'Sign up failed'
        return { success: false, message }
    }
}
export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const response = await auth.api.signInEmail({
            body: { email, password }
        })



        return { success: true, data: response }

    } catch (e) {
        console.log('Sign in failed', e)
        const message = e instanceof Error ? e.message : 'Sign in failed'
        return { success: false, message }
    }
}

export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.log('Sign out failed', e)
        return { success: false, error: 'Sign out failed' }
    }
}


