import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('google-site-verification: google0eb32fd071eb9e70.html');
  res.end();
  return { props: {} };
};

export default function GoogleVerify() {
  return null;
}
