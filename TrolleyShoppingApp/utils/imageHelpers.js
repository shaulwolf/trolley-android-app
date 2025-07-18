export const formatImageUrl = (url) => {
    if (!url) return null;
  
    const hasExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
    const hasParams = url.includes("?");
    const isASOS = url.includes("asos-media.com");
  
    if (!hasExtension && isASOS && !hasParams) {
      return `${url}?$n_640w$`;
    }
  
    return url;
  };
  