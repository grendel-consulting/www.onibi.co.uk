import * as React from "react";
import type { HeadFC, PageProps } from "gatsby";
import SEO from "../molecules/seo";
import * as styles from "../styles/site.css";

const IndexPage: React.FC<PageProps> = () => {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Onibi</h1>
      <p className={styles.paragraph}>
        We are working behind the scenes on something special.
      </p>
      <footer className={styles.footer}>
        <p>
          An imprint of Grendel Consulting Limited and Path Dependence Limited
        </p>
        <p>
          &copy; 2016-{new Date().getFullYear()} Grendel Consulting Limited. All{" "}
          rights reserved.
        </p>
      </footer>
    </main>
  );
};

export default IndexPage;

export const Head: HeadFC = () => <SEO/>;
