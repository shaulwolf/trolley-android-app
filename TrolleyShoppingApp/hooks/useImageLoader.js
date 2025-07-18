import { useState, useEffect } from "react";

export const useImageLoader = (url) => {
  const [imageUri, setImageUri] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();

        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMounted) {
            setImageUri(reader.result); 
          }
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.warn("Image load error:", error);
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return imageUri;
};
