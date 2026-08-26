export const getServerSideProps = async () => {
  return { redirect: { destination: '/dashboard', permanent: false } };
};

export default function IndexRedirect() {
  return null;
}
