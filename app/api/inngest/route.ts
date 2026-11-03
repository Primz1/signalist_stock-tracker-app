import { inngest } from "@/lib/inngest/client"
import { sendDailyNewsSummary, sendSignUpEmail } from "@/lib/inngest/functions"
import { pollMarketPrices } from "@/lib/inngest/price-poller"
import { explainSignals } from "@/lib/inngest/signal-summary"
import { serve } from "inngest/next"

export const maxDuration = 300

export const {GET, POST, PUT} = serve({
    client: inngest,
    functions:[sendSignUpEmail, sendDailyNewsSummary, pollMarketPrices, explainSignals],
})


