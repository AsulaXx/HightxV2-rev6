import { motion } from "framer-motion";

const StoreSkeleton = ({ cols = 3 }: { cols?: number }) => {
  const gridClass = cols === 2 ? "grid-cols-1 sm:grid-cols-2" : cols === 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  
  return (
    <div className="space-y-6">
      {/* Category skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 w-24 rounded-xl bg-muted/30 animate-pulse shrink-0" />
        ))}
      </div>

      {/* Product cards skeleton */}
      <div className={`grid ${gridClass} gap-4`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card !p-0 overflow-hidden"
          >
            {/* Image skeleton */}
            <div className="w-full aspect-[4/3] bg-muted/20 animate-pulse" />
            {/* Content skeleton */}
            <div className="p-4 space-y-3">
              <div className="h-3 w-16 rounded bg-muted/30 animate-pulse" />
              <div className="h-5 w-3/4 rounded bg-muted/30 animate-pulse" />
              <div className="space-y-2">
                {[1, 2].map(j => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="h-3 w-20 rounded bg-muted/20 animate-pulse" />
                    <div className="h-8 w-16 rounded-lg bg-muted/20 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default StoreSkeleton;
