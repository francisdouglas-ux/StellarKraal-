'use client';
import Card from '@/components/Card';
import SkeletonCollateralCard from '@/components/SkeletonCollateralCard';
import EmptyState from '@/components/EmptyState';

interface Collateral {
  id: string;
  animal_type: string;
  count: number;
  appraised_value: number;
  createdAt: string;
}

interface Props {
  collaterals: Collateral[];
  loading: boolean;
  onCardClick: (id: string) => void;
  onAddCollateral?: () => void;
}

const ANIMAL_ICONS: Record<string, string> = {
  cattle: '🐄',
  goat: '🐐',
  sheep: '🐑',
};

export default function CollateralGrid({
  collaterals,
  loading,
  onCardClick,
  onAddCollateral,
}: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <SkeletonCollateralCard key={i} />
        ))}
      </div>
    );
  }

  if (collaterals.length === 0) {
    return (
      <EmptyState
        icon="🐄"
        heading="No Collateral Registered"
        message="Register your livestock as collateral to unlock loans. Start by adding your first animal."
        ctaLabel="Register Collateral"
        onCta={onAddCollateral}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {collaterals.map((collateral) => {
        const xlmValue = (collateral.appraised_value / 1e7).toFixed(2);
        const usdValue = (parseFloat(xlmValue) * 0.12).toFixed(2);
        const icon = ANIMAL_ICONS[collateral.animal_type] || '🐾';

        return (
          <button
            key={collateral.id}
            onClick={() => onCardClick(collateral.id)}
            className="text-left hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-brown-600 focus:ring-offset-2 rounded-2xl"
          >
            <Card
              variant="default"
              header={
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{icon}</span>
                  <span className="bg-brown-100 dark:bg-brown-700 text-brown-700 dark:text-brown-200 text-xs font-semibold px-3 py-1 rounded-full">
                    {collateral.count}x
                  </span>
                </div>
              }
              footer={
                <p className="text-xs text-brown-500 font-mono">ID: {collateral.id.slice(0, 8)}…</p>
              }
            >
              <h3 className="text-lg font-semibold text-brown-700 dark:text-cream-50 mb-3 capitalize">
                {collateral.animal_type}
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-brown-500 mb-0.5">Appraised Value</p>
                  <p className="font-semibold text-brown-700 dark:text-cream-50">{xlmValue} XLM</p>
                  <p className="text-xs text-brown-500">${usdValue} USD</p>
                </div>
                <div>
                  <p className="text-xs text-brown-500 mb-0.5">Registered</p>
                  <p className="text-xs text-brown-600 dark:text-brown-300">
                    {new Date(collateral.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
