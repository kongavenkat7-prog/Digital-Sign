import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  return { redirect: { destination: '/dashboard', permanent: false } };
};

export default function IndexRedirect() {
  return null;
}
