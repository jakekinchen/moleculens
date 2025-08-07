import NextHead from 'next/head';

interface HeadProps {
  title?: string;
  description?: string;
}

export const Head: React.FC<HeadProps> = ({
  title = 'MolecuLens',
  description = 'Interactive Scientific Visualization Platform for Chemistry Learning',
}) => {
  return (
    <NextHead>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      {/* Favicon */}
      <link rel="icon" href="/file.svg" type="image/svg+xml" />

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
