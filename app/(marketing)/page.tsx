import MarketingLanding from '@/components/marketing/MarketingLanding';
import { getMarketingLiveData } from '@/lib/marketing/live-data';

export default async function HomePage() {
  const data = await getMarketingLiveData();
  return <MarketingLanding data={data} />;
}
