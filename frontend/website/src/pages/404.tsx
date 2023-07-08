import * as React from "react";
import { Link, HeadFC, PageProps } from "gatsby";
import SEO from "../molecules/seo";
import * as styles from "../styles/site.css";

const NotFoundPage: React.FC<PageProps> = () => {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Page Not Found</h1>
      <p className={styles.paragraph}>
        Sorry, we couldn’t find what you were looking for.
        <br />
        <Link to="/">Go home</Link>.
      </p>
    </main>
  );
};

export default NotFoundPage;

export const Head: HeadFC = () => <SEO title="Not Found"/>;
