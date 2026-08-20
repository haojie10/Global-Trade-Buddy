import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('codeva-f5tW4LkOnX');
  res.end();
  return { props: {} };
};

export default function BaiduVerifyPage() {
  return null;
}
