import React from 'react';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  priority?: boolean;
  unoptimized?: boolean;
  fill?: boolean;
}

export const Image: React.FC<ImageProps> = ({
  priority: _priority,
  unoptimized: _unoptimized,
  fill,
  className,
  style,
  alt = '',
  ...props
}) => {
  const fillStyle: React.CSSProperties = fill
    ? { position: 'absolute', height: '100%', width: '100%', inset: 0, objectFit: 'cover', ...style }
    : (style || {});

  return <img className={className} style={fillStyle} alt={alt} {...props} />;
};

export default Image;
