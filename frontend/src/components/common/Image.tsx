import React, { useState } from 'react';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholderSrc?: string;
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({ placeholderSrc, src, className = '', onLoad, ...props }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && placeholderSrc && (
        <img src={placeholderSrc} className={`img-blur ${className}`} alt="placeholder" />
      )}
      <img
        src={src}
        className={`${loaded ? 'img-loaded' : 'img-blur'} ${className}`}
        loading="lazy"
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        {...props}
      />
    </>
  );
};

export default ProgressiveImage;


