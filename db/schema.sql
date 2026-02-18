
-- MySQL schema for HP Fan Site (InnoDB + FULLTEXT)
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(190) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blog_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(190) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  tags VARCHAR(500),
  status VARCHAR(20) DEFAULT 'published',
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blog_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  author VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  is_approved TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_blog_comments_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS artists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  bio TEXT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS artworks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artist_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_path VARCHAR(500) NOT NULL,
  nsfw TINYINT(1) DEFAULT 0,
  tags VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_artworks_artist FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS writers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  bio TEXT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  writer_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  content LONGTEXT,
  tags VARCHAR(500),
  is_archived TINYINT(1) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'published',
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stories_writer FOREIGN KEY (writer_id) REFERENCES writers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book VARCHAR(20) NOT NULL,
  character VARCHAR(255),
  quote TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  pdf_path VARCHAR(500),
  pages_json MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Site-wide FULLTEXT index table
CREATE TABLE IF NOT EXISTS site_index (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  ref_id INT NOT NULL,
  title VARCHAR(255),
  body MEDIUMTEXT,
  tags VARCHAR(500),
  FULLTEXT KEY ft_title_body_tags (title, body, tags)
) ENGINE=InnoDB;

-- Triggers to sync index
DROP TRIGGER IF EXISTS blog_ai; DROP TRIGGER IF EXISTS blog_au; DROP TRIGGER IF EXISTS blog_ad;
DROP TRIGGER IF EXISTS story_ai; DROP TRIGGER IF EXISTS story_au; DROP TRIGGER IF EXISTS story_ad;
DROP TRIGGER IF EXISTS quote_ai; DROP TRIGGER IF EXISTS quote_au; DROP TRIGGER IF EXISTS quote_ad;

DELIMITER $$
CREATE TRIGGER blog_ai AFTER INSERT ON blog_posts FOR EACH ROW
BEGIN
  INSERT INTO site_index(type,ref_id,title,body,tags)
  VALUES('blog', NEW.id, NEW.title, NEW.body, NEW.tags);
END$$

CREATE TRIGGER blog_au AFTER UPDATE ON blog_posts FOR EACH ROW
BEGIN
  DELETE FROM site_index WHERE type='blog' AND ref_id=OLD.id;
  INSERT INTO site_index(type,ref_id,title,body,tags)
  VALUES('blog', NEW.id, NEW.title, NEW.body, NEW.tags);
END$$

CREATE TRIGGER blog_ad AFTER DELETE ON blog_posts FOR EACH ROW
BEGIN
  DELETE FROM site_index WHERE type='blog' AND ref_id=OLD.id;
END$$

CREATE TRIGGER story_ai AFTER INSERT ON stories FOR EACH ROW
BEGIN
  INSERT INTO site_index(type,ref_id,title,body,tags)
  VALUES('story', NEW.id, NEW.title, CONCAT(COALESCE(NEW.summary,''), '
', COALESCE(NEW.content,'')), NEW.tags);
END$$

CREATE TRIGGER story_au AFTER UPDATE ON stories FOR EACH ROW
BEGIN
  DELETE FROM site_index WHERE type='story' AND ref_id=OLD.id;
  INSERT INTO site_index(type,ref_id,title,body,tags)
  VALUES('story', NEW.id, NEW.title, CONCAT(COALESCE(NEW.summary,''), '
', COALESCE(NEW.content,'')), NEW.tags);
END$$

CREATE TRIGGER story_ad AFTER DELETE ON stories FOR EACH ROW
BEGIN
  DELETE FROM site_index WHERE type='story' AND ref_id=OLD.id;
END$$

CREATE TRIGGER quote_ai AFTER INSERT ON quotes FOR EACH ROW
BEGIN
  INSERT INTO site_index(type,ref_id,title,body,tags)
  VALUES('quote', NEW.id, CONCAT(NEW.book, ' - ', COALESCE(NEW.character,'')), NEW.quote, NULL);
END$$

CREATE TRIGGER quote_au AFTER UPDATE ON quotes FOR EACH ROW
BEGIN
  DELETE FROM site_index WHERE type='quote' AND ref_id=OLD.id;
  INSERT INTO site_index(type,ref_id,title,body,tags)
  VALUES('quote', NEW.id, CONCAT(NEW.book, ' - ', COALESCE(NEW.character,'')), NEW.quote, NULL);
END$$

CREATE TRIGGER quote_ad AFTER DELETE ON quotes FOR EACH ROW
BEGIN
  DELETE FROM site_index WHERE type='quote' AND ref_id=OLD.id;
END$$
DELIMITER ;
