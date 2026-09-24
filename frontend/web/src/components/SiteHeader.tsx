import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="/" className={styles.brand}>
          Video Streaming
        </a>
        <nav className={styles.nav}>
          <a href="/" className={styles.navLink}>
            Upload
          </a>
          <a href="/videos" className={styles.navLink}>
            Videos
          </a>
        </nav>
      </div>
    </header>
  );
}
