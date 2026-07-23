import { inngest } from "@/lib/inngest/client"
import { sendDailyNewsSummary, sendSignUpEmail, monitorPriceAlerts } from "@/lib/inngest/functions"
import { captureMarketSnapshots } from "@/lib/inngest/market-snapshots"
import { pollMarketPrices } from "@/lib/inngest/price-poller"
import { serve } from "inngest/next"


export const {GET, POST, PUT} = serve({
    client: inngest,
    functions:[sendSignUpEmail, sendDailyNewsSummary, monitorPriceAlerts, captureMarketSnapshots, pollMarketPrices],
})


