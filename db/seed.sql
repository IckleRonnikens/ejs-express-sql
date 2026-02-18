
INSERT INTO artists(name,bio) VALUES ('Luna Artistry','Magical illustrations'), ('Fred Draws','Sketch artist');
INSERT INTO artworks(artist_id,title,description,image_path,nsfw,tags) VALUES
(1,'Hogwarts at Dawn','Watercolour','/public/uploads/art/sample1.jpg',0,'hogwarts,landscape'),
(2,'Dark Forest','Ink','/public/uploads/art/sample2.jpg',1,'forest,dark');

INSERT INTO writers(name,bio) VALUES ('Hermione Writes','Detailed lore'), ('Neville Notes','Calm botanist tales');
INSERT INTO stories(writer_id,title,summary,content,tags) VALUES
(1,'The Library’s Secret','A hidden shelf...','Once upon a time...', 'mystery,library'),
(2,'Greenhouse Night','Moonlit discovery...','Plants whisper...', 'adventure,botany');

INSERT INTO blog_posts(slug,title,body,tags) VALUES
('welcome','Welcome to the fan site','<p>Hello, world!</p>','news,intro'),
('update-1','Site Update','<p>New features added.</p>','updates');

INSERT INTO quotes(book,character,quote) VALUES
('ps','Dumbledore','It does not do to dwell on dreams and forget to live.'),
('gof','Dumbledore','Differences of habit and language are nothing at all.');
