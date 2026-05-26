--/////////////////////////////////////////////
-- 1. LOG & SYSTEM
--DROP TABLE IF EXISTS message_queue_log CASCADE;
-- =======================================================
DROP TABLE IF EXISTS
    message_queue_log,
    login_history,
    audit_log,
    recommendation_log,
    user_preference,
    favorite_meal_set,
    meal_set_recipe,
    meal_set,
    rating,
    favorite_recipe,
    recipe_ingredient_map,
    recipe,
    ingredient,
    user_premium_history,
    payment,
    premium_plan,
    refresh_token,
    user_role,
    role,
    app_user
CASCADE;
--////////////////////////////////////////////


-- USER

create table app_user( 
	user_id serial primary key,
	email varchar (100) not null, -- dang nhap bang email
	password_hash varchar (255) not null, -- cai nay se hash ben c#
	full_name varchar (100), -- dang ky can ho ten
	avatar_url varchar (255),
	status varchar (40) check (status in ('ACTIVE', 'BLOCKED', 'DELETED')) default 'ACTIVE',
	
	--chieu cao, can nang
--	height float,
--	weight float, 
--	bmi numeric (4,2) 
--	GENERATED ALWAYS AS (
--    CASE 
--        WHEN height > 0 THEN weight / ((height/100.0) * (height/100.0)) 
--        ELSE 0 
--    END
--) stored,
	create_at timestamp default current_timestamp,
	deleted_at timestamp default null
	
);
create table role (
	role_id serial primary key, 
	role_name varchar (50) unique not null
);

create table user_role (
	user_id int,
	role_id int, 
	primary key (user_id, role_id),
	foreign key (user_id) references app_user(user_id),
	foreign key (role_id) references role (role_id)
);

--TOKEN
create table refresh_token (
	token_id serial primary key,
	user_id int not null,
	token text not null,
	expired_at timestamp not null, --thoi gian het han
	device_info varchar (100),
	ip_address varchar (50),
	is_revoked boolean default false, --duoc thu hoi
	create_at timestamp default current_timestamp,
	foreign key (user_id) references app_user (user_id)
);

--PREMIUM & PAYMENT
--cac goi premium
create table premium_plan (
	plan_id serial primary key,
	plan_name varchar (50) not null,
	price numeric (10, 2) not null, 
	duration_days int not null, --ngay het han
	description text,
	is_active boolean default true
);

create table payment (
	payment_id serial primary key,
	user_id int,
	plan_id int,
	amount numeric (10, 2),
	internal_reference VARCHAR(100) UNIQUE NOT NULL, -- Mã gửi đi cổng thanh toán (VD: PAY_USER1_1690000)
	transaction_code varchar (100), -- ma giao dich tu ben thu 3 trả về để đối soát
	status VARCHAR(20) CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED')) DEFAULT 'PENDING',
	paid_at timestamp,     --luc user thuc su thanh toan xong
	create_at timestamp default current_timestamp,
	foreign key (user_id) references app_user (user_id),
	foreign key (plan_id) references premium_plan (plan_id)
);
create table user_premium_history (
	history_id serial primary key, 
	user_id int,
	plan_id int, 
	payment_id int NOT NULL UNIQUE,
	start_date timestamp,
	end_date timestamp,
	foreign key (user_id) references app_user(user_id),
	foreign key (plan_id) references premium_plan(plan_id),
	foreign key (payment_id) references payment(payment_id)
);

--INGREDIENT & RECIPE
create table ingredient (
	ingredient_id serial primary key,
	name varchar (100) not null,
	type varchar (20) check (type in ('MEAT', 'VEGETABLE', 'SPICE', 'FRUIT', 'OTHER', 'STARCH')), -- CAI NAY DE LOC 
	image_url varchar (500),
	is_common BOOLEAN DEFAULT FALSE, -- cai nay de hien thi nguyen lieu pho bien
	status varchar (20) check (status in ('ACTIVE', 'HIDDEN')) default 'ACTIVE', -- xoa mem nguyen lieu
	keywords TEXT, -- luu cac tu dong nghia de search
	create_at timestamp default current_timestamp
);

CREATE TABLE recipe (
    recipe_id SERIAL PRIMARY KEY,
    author_id INT REFERENCES app_user(user_id),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    ingredients_json JSONB NOT NULL, -- Chi tiết nguyên liệu & định lượng|| cai nay tac dung same khoa ngoai nma minh se code de tham chieu no den bang ben tren
    --chinh vi the neu co nhieu tk cung co id = 1 thi khi code se co 3 th
    --1. code tham chieu = sql, luc nay no se lay tat ca tk co id vua tim
    --2. code logic o BE --> tuy vao cai sd se ra dc 1 hoac tat ca
    ----> can 
    steps_json JSONB NOT NULL,       -- Các bước thực hiện
    dish_type VARCHAR(100),
    image_url VARCHAR(500),
    total_calories NUMERIC(6,2),
    cooking_time INT,
    difficulty VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE recipe
ADD COLUMN status VARCHAR(20) CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN')) DEFAULT 'APPROVED';

-- 2. Cập nhật các bản ghi cũ về 'APPROVED' (nếu cần)
UPDATE recipe SET status = 'APPROVED' WHERE status IS NULL;


--//:tim kiem nhan goi y sieu nhanh
CREATE TABLE recipe_ingredient_map (
    recipe_id INT REFERENCES recipe(recipe_id) ON DELETE CASCADE, -- cai nay no chinh la
    ingredient_id INT REFERENCES ingredient(ingredient_id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, ingredient_id)
);


--Rating
CREATE TABLE rating (
    rating_id SERIAL PRIMARY KEY,
    user_id INT,
    recipe_id INT,
    score INT CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(recipe_id)
);

--MEAL
create table meal_set (
	meal_set_id serial primary key,
	name varchar (100),
	target_calories numeric (6,2),
	meal_type varchar (50), 
	user_id int, -- nguoi tao ra cai bua com nay 
	total_calories numeric (10, 2) default 0,
	image_url varchar (500),
	goal_type VARCHAR(20) CHECK (goal_type IN ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT')),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES app_user(user_id)
);

create table meal_set_recipe (
	meal_set_id int,
	recipe_id int,
	primary key (meal_set_id, recipe_id),
	foreign key (meal_set_id) references meal_set (meal_set_id),
	foreign key (recipe_id) references recipe (recipe_id)
);

-- Đồng bộ total_calories của meal_set theo tổng calories các recipe đã map.
CREATE OR REPLACE FUNCTION sync_meal_set_total_calories(p_meal_set_id int)
RETURNS void AS $$
BEGIN
	UPDATE meal_set ms
	SET total_calories = COALESCE(calc.total_calories, 0)::numeric(10,2)
	FROM (
		SELECT ms2.meal_set_id, SUM(COALESCE(r.total_calories, 0)) AS total_calories
		FROM meal_set ms2
		LEFT JOIN meal_set_recipe msr ON msr.meal_set_id = ms2.meal_set_id
		LEFT JOIN recipe r ON r.recipe_id = msr.recipe_id
		WHERE ms2.meal_set_id = p_meal_set_id
		GROUP BY ms2.meal_set_id
	) calc
	WHERE ms.meal_set_id = calc.meal_set_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_sync_meal_set_total_calories_from_map()
RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		PERFORM sync_meal_set_total_calories(NEW.meal_set_id);
		RETURN NEW;
	ELSIF TG_OP = 'UPDATE' THEN
		IF NEW.meal_set_id <> OLD.meal_set_id THEN
			PERFORM sync_meal_set_total_calories(OLD.meal_set_id);
		END IF;
		PERFORM sync_meal_set_total_calories(NEW.meal_set_id);
		RETURN NEW;
	ELSE
		PERFORM sync_meal_set_total_calories(OLD.meal_set_id);
		RETURN OLD;
	END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meal_set_recipe_sync_total_calories
AFTER INSERT OR UPDATE OR DELETE ON meal_set_recipe
FOR EACH ROW
EXECUTE FUNCTION trg_sync_meal_set_total_calories_from_map();

CREATE OR REPLACE FUNCTION trg_sync_meal_set_total_calories_from_recipe()
RETURNS trigger AS $$
BEGIN
	UPDATE meal_set ms
	SET total_calories = COALESCE(calc.total_calories, 0)::numeric(10,2)
	FROM (
		SELECT ms2.meal_set_id, SUM(COALESCE(r.total_calories, 0)) AS total_calories
		FROM meal_set ms2
		LEFT JOIN meal_set_recipe msr ON msr.meal_set_id = ms2.meal_set_id
		LEFT JOIN recipe r ON r.recipe_id = msr.recipe_id
		WHERE ms2.meal_set_id IN (
			SELECT DISTINCT msr2.meal_set_id
			FROM meal_set_recipe msr2
			WHERE msr2.recipe_id = NEW.recipe_id
		)
		GROUP BY ms2.meal_set_id
	) calc
	WHERE ms.meal_set_id = calc.meal_set_id;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_sync_total_calories
AFTER UPDATE OF total_calories ON recipe
FOR EACH ROW
EXECUTE FUNCTION trg_sync_meal_set_total_calories_from_recipe();

-- FAVORITE USER
CREATE TABLE favorite_recipe (
    user_id INT NOT NULL,
    recipe_id INT NOT NULL,
    primary key (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(recipe_id)
);

CREATE TABLE favorite_meal_set (
    user_id INT,        
    meal_set_id INT,    
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, meal_set_id), 
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (meal_set_id) REFERENCES meal_set(meal_set_id)
);

--AI
create table user_preference (
	user_id int primary key,
	diet_type varchar (50),
	allergy text,
	dislike_ingredient text,
	--cai nay nhu kieu la de luu lai lich su cua cai thanh o bua an
	current_goal VARCHAR(20) CHECK (current_goal IN ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT')),
	target_calories numeric (6,2),
	foreign key (user_id) references app_user(user_id)
);


create table recommendation_log ( --cai bang nay no chinh la bang goi y
	log_id serial primary key,
	user_id int,
	input_data JSON,
	result JSON, 
	created_at timestamp default current_timestamp,
	input_type VARCHAR(20) CHECK (input_type IN ('MANUAL_SELECT', 'TEXT', 'VOICE', 'IMAGE')),
	foreign key (user_id) references app_user(user_id)
);



select * from ingredient;

-- Add equipped_title to app_user
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS equipped_title VARCHAR(100);

-- Table for achievement definitions
CREATE TABLE IF NOT EXISTS achievement (
    achievement_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    criteria_type VARCHAR(50) NOT NULL, -- RECIPE_COUNT, REVIEW_COUNT, FAVORITE_COUNT, MEAL_SET_COUNT
    criteria_value INT NOT NULL,
    title_reward VARCHAR(100),
    icon_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to track user progress and completion
CREATE TABLE IF NOT EXISTS user_achievement (
    user_id INT REFERENCES app_user(user_id) ON DELETE CASCADE,
    achievement_id INT REFERENCES achievement(achievement_id) ON DELETE CASCADE,
    progress INT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
);

-- Seed achievements
INSERT INTO achievement (name, description, criteria_type, criteria_value, title_reward) VALUES
('Người mới vào bếp', 'Đăng tải 1 công thức được duyệt', 'RECIPE_COUNT', 1, 'Tập sự đầu bếp'),
('Đầu bếp nghiệp dư', 'Đăng tải 5 công thức được duyệt', 'RECIPE_COUNT', 5, 'Đầu bếp nghiệp dư'),
('Vua đầu bếp', 'Đăng tải 20 công thức được duyệt', 'RECIPE_COUNT', 20, 'Vua đầu bếp'),
('Người đánh giá tận tâm', 'Gửi 5 đánh giá cho các công thức', 'REVIEW_COUNT', 5, 'Chuyên gia phê bình'),
('Kẻ sành ăn', 'Lưu 10 công thức vào mục yêu thích', 'FAVORITE_COUNT', 10, 'Kẻ sành ăn'),
('Chuyên gia lên thực đơn', 'Lưu 5 mâm cơm yêu thích', 'MEAL_SET_COUNT', 5, 'Kiến trúc sư món ăn');
