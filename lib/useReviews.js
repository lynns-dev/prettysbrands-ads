import React from 'react';

// Fetches { [productId]: { reviews, average, count } } once and shares it
// across any component that needs real per-product rating data.
export function useAllReviews() {
  const [data, setData] = React.useState({});

  React.useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return data;
}
