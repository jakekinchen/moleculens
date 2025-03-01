import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Head } from '@/components/layout/Head';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head />
      <Component {...pageProps} />
    </>
  );
} 