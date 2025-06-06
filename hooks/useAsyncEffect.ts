import { useEffect } from "react";

const useAsyncEffect = (effect: () => Promise<void>, dependencies: any[]) => {
  useEffect(() => {
    effect();
  }, dependencies);
};

export default useAsyncEffect;
