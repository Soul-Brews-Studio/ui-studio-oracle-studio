export function PlanetsLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-3 bg-black">
      <div className="text-lg text-text-primary">Loading planets...</div>
      <div className="text-[13px] text-text-muted">
        Fetching embeddings and building the universe...
      </div>
    </div>
  );
}

interface EmptyProps {
  message?: string;
}

export function PlanetsEmpty({ message }: EmptyProps) {
  const hasError = Boolean(message);
  return (
    <div
      className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-3 bg-black text-center px-6"
    >
      <div
        className={`text-[22px] font-bold ${hasError ? 'text-[#ef4444]' : 'text-text-primary'}`}
      >
        {hasError ? 'Failed to load planets' : 'No Planets Yet'}
      </div>
      <div className="text-sm text-text-muted leading-relaxed max-w-md">
        {hasError ? (
          message
        ) : (
          <>
            The planets universe needs vector embeddings from LanceDB.
            <br />
            Run a vector index to populate the map.
          </>
        )}
      </div>
    </div>
  );
}
