import NextHead from 'next/head';
import { Favicon } from '@/components/icons/Favicon';
import ReactDOMServer from 'react-dom/server';

interface HeadProps {
  title?: string;
  description?: string;
}

export const Head: React.FC<HeadProps> = ({
  title = 'MolecuLens',
  description = 'Interactive Scientific Visualization Platform for Chemistry Learning',
}) => {
  const faviconSvg = ReactDOMServer.renderToString(<Favicon />);
  const faviconUrl = `data:image/svg+xml;base64,${Buffer.from(faviconSvg).toString('base64')}`;

  return (
    <NextHead>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      
      {/* Favicon */}
      <link rel="icon" href={faviconUrl} type="image/svg+xml" />
      
      {/* Apple Touch Icon */}
      <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="/images/og-image.png" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="/images/twitter-image.png" />
    </NextHead>
  );
}; 