-- =======================================================
-- BƯỚC 1: DỌN DẸP DỮ LIỆU CŨ
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
-- =======================================================
-- BƯỚC 2: INSERT DATA
-- =======================================================
select * from app_user;
--////////////////////////////
-- 4. USER 
INSERT INTO app_user (email, password_hash, full_name, status) VALUES 
('hoa@gmail.com', 'Hoa_24122005', 'Nguyễn Thị Hoa', 'ACTIVE'),
('nam@gmail.com', 'Abc@123', 'Trần Văn Nam', 'ACTIVE'),
('lan@gmail.com', 'Abc@123', 'Lê Thị Lan', 'ACTIVE'),
('hung@gmail.com', 'Abc@123', 'Phạm Văn Hùng', 'ACTIVE'),
('mai@gmail.com', 'Abc@123', 'Hoàng Thị Mai', 'ACTIVE'),
('tuan@gmail.com', 'Abc@123', 'Vũ Anh Tuấn', 'ACTIVE'),
('cuc@gmail.com', 'Abc@123', 'Ngô Thu Cúc', 'BLOCKED'),
('truc@gmail.com', 'Abc@123', 'Đinh Thanh Trúc', 'ACTIVE'),
('minh@gmail.com', 'Abc@123', 'Lý Bình Minh', 'ACTIVE'),
('hieu@gmail.com', 'Abc@123', 'Trương Trung Hiếu', 'ACTIVE'),
('thao@gmail.com', 'Abc@123', 'Bùi Phương Thảo', 'ACTIVE'),
('dat@gmail.com', 'Abc@123', 'Đỗ Thành Đạt', 'DELETED'),
('linh@gmail.com', 'Abc@123', 'Dương Thùy Linh', 'ACTIVE'),
('quan@gmail.com', 'Abc@123', 'Hà Anh Quân', 'ACTIVE'),
('nhung@gmail.com', 'Abc@123', 'Phan Tuyết Nhung', 'ACTIVE'),
('son@gmail.com', 'Abc@123', 'Cao Thái Sơn', 'ACTIVE'),
('ha@gmail.com', 'Abc@123', 'Trịnh Thu Hà', 'ACTIVE'),
('phong@gmail.com', 'Abc@123', 'Lưu Thanh Phong', 'ACTIVE'),
('yenca@gmail.com', 'Abc@123', 'Nguyễn Hải Yến', 'ACTIVE'),
('duy@gmail.com', 'Abc@123', 'Trần Khánh Duy', 'ACTIVE'),
('nga@gmail.com', 'Abc@123', 'Phạm Quỳnh Nga', 'ACTIVE'),
('khoi@gmail.com', 'Abc@123', 'Hoàng Minh Khôi', 'ACTIVE'),
('vy@gmail.com', 'Abc@123', 'Vũ Tường Vy', 'ACTIVE'),
('thinh@gmail.com', 'Abc@123', 'Ngô Quốc Thịnh', 'ACTIVE'),
('tram@gmail.com', 'Abc@123', 'Đinh Bích Trâm', 'ACTIVE'),
('long@gmail.com', 'Abc@123', 'Lý Hoàng Long', 'ACTIVE'),
('khoe@gmail.com', 'Abc@123', 'Trương Mạnh Khỏe', 'ACTIVE'),
('ngoc@gmail.com', 'Abc@123', 'Bùi Bảo Ngọc', 'ACTIVE'),
('phuc@gmail.com', 'Abc@123', 'Đỗ Tấn Phúc', 'ACTIVE'),
('quyen@gmail.com', 'Abc@123', 'Dương Lệ Quyên', 'ACTIVE');

--///////////////////////////////

-- 1. ROLE
INSERT INTO role (role_name) VALUES 
('ADMIN'), ('USER'), ('PREMIUM_USER');
select * from role;

-- 2. PREMIUM PLAN
INSERT INTO premium_plan (plan_name, price, duration_days, description) VALUES 
('Gói Tuần', 20000, 7, 'Gói trải nghiệm'),
('Gói Tháng', 59000, 30, 'Gói phổ biến'),
('Gói Năm', 599000, 365, 'Gói tiết kiệm');
select * from premium_plan;

-- 5. USER ROLE
INSERT INTO user_role (user_id, role_id) VALUES 
(1, 1), (2, 2), (3, 2), (4, 2), (5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 2),
(11, 2), (12, 2), (13, 2), (14, 2), (15, 2), (16, 2), (17, 2), (18, 2), (19, 2), (20, 2),
(21, 2), (22, 2), (23, 2), (24, 2), (25, 2), (26, 2), (27, 2), (28, 2), (29, 2), (30, 2);

--/////////////////////////////////////


-- 3. INGREDIENT
INSERT INTO ingredient (name, type, is_common) VALUES 
('Thịt gà ức', 'MEAT', true),
('Thịt bò nạc', 'MEAT',  true),
('Thịt heo ba chỉ', 'MEAT', true),
('Cá hồi', 'MEAT', false),
('Tôm sú', 'MEAT',  true),
('Trứng gà', 'OTHER', true),
('Đậu phụ', 'OTHER', true),
('Gạo tẻ', 'STARCH',  true), 
('Gạo lứt', 'STARCH',false),
('Khoai tây', 'VEGETABLE',  true),
('Khoai lang', 'VEGETABLE', true),
('Cà rốt', 'VEGETABLE',true),
('Cà chua', 'VEGETABLE',true),
('Rau muống', 'VEGETABLE',  true),
('Súp lơ xanh', 'VEGETABLE',  true),
('Cải thìa', 'VEGETABLE', true),
('Hành tây', 'VEGETABLE', true),
('Tỏi', 'SPICE',  true),
('Ớt', 'SPICE', true),
('Gừng', 'SPICE', true),
('Muối', 'SPICE', true),
('Đường', 'SPICE',  true),
('Nước mắm', 'SPICE',  true),
('Dầu ăn', 'OTHER', true), 
('Dầu hào', 'SPICE', true),
('Táo', 'FRUIT', true),
('Chuối', 'FRUIT', true),
('Cam', 'FRUIT',  true),
('Bơ', 'FRUIT', false),
('Hành lá', 'VEGETABLE', true),
('Sả tươi', 'SPICE', true),
('Giá đỗ', 'VEGETABLE', true),
('Mướp đắng', 'VEGETABLE', true),
('Nấm kim châm', 'VEGETABLE', true),
('Cá thu', 'MEAT',  true),
('Mắm tôm', 'SPICE',  true),
('Tương ớt', 'SPICE', true),
('Yến mạch', 'STARCH',false), -- Xu hướng Healthy
('Hạt chia', 'OTHER', false), -- Xu hướng Healthy
('Bún tươi', 'STARCH',  true),
('Bánh mì', 'STARCH', true), 
('Trứng', 'OTHER', true), 
('Chanh', 'SPICE', true);




--THÊM NGUYÊN LIỆU
INSERT INTO ingredient (name, type, is_common, status, keywords)
SELECT v.name, v.type, v.is_common, 'ACTIVE', v.keywords
FROM (
VALUES
('Súp lơ', 'VEGETABLE', true, 'súp lơ, bông cải xanh'),
('Đậu xanh', 'VEGETABLE', true, 'đậu xanh, đỗ xanh'),
('Cần tây', 'VEGETABLE', true, 'cần tây'),
('Táo', 'FRUIT', true, 'táo'),
('Quả mơ', 'FRUIT', false, 'mơ, quả mơ'),
('Măng tây', 'VEGETABLE', true, 'măng tây'),
('Thịt xông khói', 'MEAT', false, 'thịt xông khói, ba chỉ xông khói'),
('Bánh mì', 'STARCH', true, 'bánh mì'),
('Bánh ngọt', 'STARCH', false, 'bánh ngọt'),
('Bánh kếp', 'STARCH', false, 'bánh kếp'),
('Bánh kem', 'STARCH', false, 'bánh kem'),
('Bánh cuộn', 'STARCH', false, 'bánh cuộn'),
('Bánh quy', 'STARCH', true, 'bánh quy, quy'),
('Chuối', 'FRUIT', true, 'chuối'),
('Thịt bò', 'MEAT', true, 'thịt bò, bò'),
('Ớt chuông', 'VEGETABLE', true, 'ớt chuông'),
('Quả việt quất', 'FRUIT', false, 'việt quất, quả việt quất'),
('Xúc xích xông khói', 'MEAT', false, 'xúc xích xông khói'),
('Xúc xích', 'MEAT', true, 'xúc xích'),
('Cải thìa', 'VEGETABLE', true, 'cải thìa'),
('Bơ hộp', 'OTHER', false, 'bơ hộp, bơ'),
('Bắp cải', 'VEGETABLE', true, 'bắp cải'),
('Kẹo', 'OTHER', false, 'kẹo'),
('Ngô đóng hộp', 'STARCH', false, 'ngô đóng hộp, bắp đóng hộp'),
('Dứa đóng hộp', 'FRUIT', false, 'dứa đóng hộp, thơm đóng hộp'),
('Cá hồi đóng hộp', 'MEAT', false, 'cá hồi đóng hộp'),
('Cà rốt', 'VEGETABLE', true, 'cà rốt'),
('Hạt điều', 'OTHER', false, 'hạt điều'),
('Phô mai', 'OTHER', true, 'phô mai'),
('Quả cherry', 'FRUIT', false, 'cherry, quả cherry'),
('Thịt gà', 'MEAT', true, 'thịt gà, gà'),
('Ức gà', 'MEAT', true, 'ức gà'),
('Ớt đỏ', 'VEGETABLE', true, 'ớt đỏ'),
('Sô cô la', 'OTHER', false, 'sô cô la, chocolate'),
('Dừa', 'FRUIT', true, 'dừa'),
('Cà phê', 'OTHER', false, 'cà phê'),
('Sữa đặc', 'OTHER', true, 'sữa đặc'),
('Dầu ăn', 'OTHER', true, 'dầu ăn'),
('Ngô', 'STARCH', true, 'ngô, bắp'),
('Phô mai tươi', 'OTHER', false, 'phô mai tươi'),
('Kem', 'OTHER', false, 'kem'),
('Dưa chuột', 'VEGETABLE', true, 'dưa chuột, dưa leo'),
('Trứng', 'OTHER', true, 'trứng'),
('Cà tím', 'VEGETABLE', true, 'cà tím'),
('Cá', 'MEAT', true, 'cá'),
('Bột mì', 'STARCH', true, 'bột mì'),
('Tỏi', 'SPICE', true, 'tỏi'),
('Gừng', 'SPICE', true, 'gừng'),
('Bưởi', 'FRUIT', true, 'bưởi'),
('Nho', 'FRUIT', true, 'nho'),
('Ớt xanh', 'VEGETABLE', true, 'ớt xanh'),
('Hành tây', 'VEGETABLE', true, 'hành tây'),
('Giăm bông', 'MEAT', false, 'giăm bông, ham'),
('Nước sốt', 'SPICE', false, 'nước sốt, sốt'),
('Mứt', 'OTHER', false, 'mứt'),
('Kiwi', 'FRUIT', false, 'kiwi'),
('Đậu bắp', 'VEGETABLE', true, 'đậu bắp'),
('Tỏi tây', 'VEGETABLE', true, 'tỏi tây'),
('Chanh', 'FRUIT', true, 'chanh'),
('Xà lách', 'VEGETABLE', true, 'xà lách, rau xà lách'),
('Xoài', 'FRUIT', true, 'xoài'),
('Sốt mayonnaise', 'OTHER', false, 'mayonnaise'),
('Thịt viên', 'MEAT', false, 'thịt viên'),
('Dưa gang', 'FRUIT', false, 'dưa gang'),
('Sữa', 'OTHER', true, 'sữa'),
('Phô mai mozzarella', 'OTHER', true, 'mozzarella, phô mai mozzarella'),
('Nấm', 'VEGETABLE', true, 'nấm'),
('Mì', 'STARCH', true, 'mì'),
('Cam', 'FRUIT', true, 'cam'),
('Hàu', 'MEAT', false, 'hàu'),
('Nước lọc', 'OTHER', true, 'nước lọc'),
('Đu đủ', 'FRUIT', true, 'đu đủ'),
('Đào', 'FRUIT', true, 'đào'),
('Lạc', 'OTHER', true, 'lạc, đậu phộng'),
('Lê', 'FRUIT', true, 'lê'),
('Dứa', 'FRUIT', true, 'dứa, thơm'),
('Thịt lợn', 'MEAT', true, 'thịt lợn, thịt heo'),
('Cháo', 'STARCH', false, 'cháo'),
('Khoai tây', 'STARCH', true, 'khoai tây'),
('Bí ngô', 'VEGETABLE', true, 'bí ngô'),
('Củ cải', 'VEGETABLE', true, 'củ cải'),
('Trứng cá muối đỏ', 'OTHER', false, 'trứng cá muối đỏ'),
('Cơm', 'STARCH', true, 'cơm'),
('Rau xà lách', 'VEGETABLE', true, 'rau xà lách, xà lách'),
('Muối', 'SPICE', true, 'muối'),
('Tôm', 'MEAT', true, 'tôm'),
('Rau chân vịt', 'VEGETABLE', true, 'rau chân vịt, cải bó xôi'),
('Hành lá', 'VEGETABLE', true, 'hành lá'),
('Dâu tây', 'FRUIT', true, 'dâu tây'),
('Đường', 'SPICE', true, 'đường'),
('Khoai lang', 'STARCH', true, 'khoai lang'),
('Đậu phụ', 'OTHER', true, 'đậu phụ'),
('Cà chua', 'VEGETABLE', true, 'cà chua'),
('Cá hồi', 'MEAT', true, 'cá hồi'),
('Sữa chua', 'OTHER', true, 'sữa chua'),
('Bí xanh', 'VEGETABLE', true, 'bí xanh'),
('Mực', 'MEAT', true, 'mực'),
('Rau muống', 'VEGETABLE', true, 'rau muống'),
('Rau củ', 'VEGETABLE', false, 'rau củ'),
('Rau dền', 'VEGETABLE', true, 'rau dền'),
('Rau mồng tơi', 'VEGETABLE', true, 'rau mồng tơi'),
('Su hào', 'VEGETABLE', true, 'su hào'),
('Gạo tẻ', 'STARCH', true, 'gạo tẻ'),
('Gạo lứt', 'STARCH', true, 'gạo lứt'),
('Gạo nếp', 'STARCH', true, 'gạo nếp'),
('Dưa hấu', 'FRUIT', true, 'dưa hấu'),
('Măng tươi', 'VEGETABLE', false, 'măng tươi'),
('Thì là', 'SPICE', true, 'thì là'),
('Tiêu', 'SPICE', true, 'hạt tiêu')
('Cá', 'MEAT', true)  --id: 134
) AS v(name, type, is_common, keywords)
WHERE NOT EXISTS (
	SELECT 1
	FROM ingredient i
	WHERE LOWER(i.name) = LOWER(v.name)
);

COMMIT;
DELETE FROM ingredient
WHERE name = 'Cá';
--DELETE FROM ingredient WHERE ingredient_id = 44;
select * from ingredient;
select *from recipe;

-- 7. RECIPE:-- cần bắt đkien trùng, chưa có id, tên món ch có trg list nguyên liệu

-- Món 1: ức gà luộc 
(1, 'Ức gà', 'Món ức gà tươi ngon nhiều dinh dưỡng', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 500, "unit": "g"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Làm sạch ức gà với nước"}, {"step": 2, "content": "Cho lên nồi đun 20"}, {"step": 3, "content": "Cho mắm vào" }, {"step": 4, "content": "Đợi 20 phút rồi cho ra đĩa"}]'::JSONB, 'MAIN_DISH', 40, 'EASY', 250),

-- Món 2: Thịt bò xào hành tây
(1, 'Thịt bò xào hành tây', 'Thịt bò xào hành tây siêu ngon', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 400, "unit": "g"}, {"id": 17, "name": "Hành tây", "qty": 1, "unit": "củ"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Sơ chế hành tây, thịt bò"}, {"step": 2, "content": "Xào hành tây gần chín"}, {"step": 3, "content": "Cho thịt bò vào đảo kèm mắm"}, {"step": 4, "content": "Xào khoảng 8 phút rồi cho ra đĩa"}]'::JSONB, 'MAIN_DISH', 25, 'EASY', 450),

-- Món 3: Thịt bò xào gừng
(1,  'Thịt bò xào gừng', 'Thịt bò xào gừng',
'[{"id": 2, "name": "Thịt bò nạc", "qty": 400, "unit": "g"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Lạo vỏ gừng"}, {"step": 2, "content": "Cho gừng vào xào qua trước"}, {"step": 3, "content": "Cho thịt bò vào đảo kèm mắm"}, {"step": 4, "content": "Xào khoảng 8 phút rồi cho ra đĩa"}]'::JSONB, 'MAIN_DISH', 20, 'MEDIUM', 480),

-- Món 4: Trứng chiên hành
(1, 'Trứng chiên hành', 'Món ăn nhanh gọn', 
'[{"id": 42, "name": "Trứng", "qty": 3, "unit": "quả"}, {"id": 30, "name": "Hành lá", "qty": 2, "unit": "nhánh"}, {"id": 21, "name": "Muối", "qty": 1, "unit": "thìa"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"} ]'::JSONB,
'[{"step": 1, "content": "Đánh trứng kèm hành lá và muối"},{"step": 2, "content": "Cho dầu ăn vào chờ tầm 2 phút"}, {"step": 3, "content": "Cho trứng vào chảo"}, {"step": 4, "content": "Chờ 2 phút rồi lật trứng"},{"step": 5, "content": "Chờ thêm 2 phút rồi cho ra đĩa"}]'::JSONB, 'SIDE_DISH', 10, 'EASY', 220),

-- Món 5: Cá hồi áp chảo
(1, 'Cá hồi áp chảo', 'Món ăn sang trọng', 
'[{"id": 4, "name": "Cá hồi", "qty": 200, "unit": "g"}, {"id": 43, "name": "Chanh", "qty": 0.5, "unit": "quả"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Cho dầu ăn vào đợi khoảng 1 phút"},{"step": 2, "content": "Cho cá vào áp chảo"}, {"step": 3, "content": "Chờ khoảng 2 phút rồi lật lại"},  {"step": 4, "content": "Chờ 2 phút cho chín rồi mang ra đĩa và vắt chanh"}]'::JSONB, 'MAIN_DISH', 15, 'MEDIUM', 350),

-- Món 6: Thịt bò hầm cà rốt
(1, 'Bò hầm cà rốt', 'Món bò hầm mềm', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 500, "unit": "g"}, {"id": 12, "name": "Cà rốt", "qty": 2, "unit": "củ"}, {"id": 21, "name": "Muối", "qty": 1, "unit": "thìa"}]'::JSONB,
'[{"step": 1, "content": "Ướp bò với muối tầm 30 đến 40 phút"}, {"step": 2, "content": "Hầm với cà rốt tầm 2 đến 3 tiếng cho nhừ"}]'::JSONB, 'MAIN_DISH', 90, 'HARD', 520),

-- Món 7: Salad cà rốt chanh
(1, 'Salad cà rốt chanh', 'Món khai vị giảm cân', 
'[{"id": 12, "name": "Cà rốt", "qty": 2, "unit": "củ"}, {"id": 43, "name": "Chanh", "qty": 0.5, "unit": "quả"}]'::JSONB,
'[{"step": 1, "content": "Lạo sạch cà rốt và rửa sạch"},{"step": 2, "content": "Bào sợi cà rốt"}, {"step": 3, "content": "Trộn nước cốt chanh"}]'::JSONB, 'SIDE_DISH', 10, 'EASY', 100),

-- Món 8: Nước chanh gừng
(1, 'Nước chanh gừng', 'Thức uống giải cảm', 
'[{"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"},  {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}]'::JSONB,
'[{"step": 1, "content": "Giã gừng"}, {"step": 2, "content": "Pha nước chanh"}, {"step": 3, "content": "Cho gừng vào nước chanh"}]'::JSONB, 'DRINK', 5, 'EASY', 80),

-- Món 9: Đậu rán
(1, 'Đậu rán', 'Món ăn đơn giản nhưng ngon siêu cấp', 
'[{"id": 7, "name": "Đậu phụ", "qty": 3, "unit": "cái"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Cắt đậu thành miếng vuông hoặc lát 3cm"},{"step": 2, "content": "Cho dầu ăn vào chảo chờ tầm 1 phút"}, {"step": 3, "content": "Cho đậu vào rán và lật khi chín"}]'::JSONB, 'MAIN_DISH', 30, 'EASY', 150),

-- Món 10: Bún đậu mắm tôm
(1, 'Bún đậu mắm tôm', 'Món bún đậu như tên', 
'[{"id": 7, "name": "Đậu phụ", "qty": 5, "unit": "cái"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}, {"id": 36, "name": "Mắm tôm", "qty": 15, "unit": "ml"}, {"id": 40, "name": "Bún tươi", "qty": 1, "unit": "cân"}]'::JSONB,
'[{"step": 1, "content": "Cắt đậu thành miếng vuông hoặc lát 3cm"},{"step": 2, "content": "Cho dầu ăn vào chảo chờ tầm 1 phút"}, {"step": 3, "content": "Cho đậu vào rán và lật khi chín"},{"step": 4, "content": "Bày ra đĩa kèm mắm tôm và bún"}]'::JSONB, 'MAIN_DISH', 15, 'EASY', 420),

-- Món 11: Salad gà cà rốt
(1, 'Salad gà cà rốt', 'Món ăn giàu protein và chất xơ', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 300, "unit": "g"}, {"id": 12, "name": "Cà rốt", "qty": 1, "unit": "củ"}, {"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"}]'::JSONB,
'[{"step": 1, "content": "Luộc chín ức gà và xé nhỏ"}, {"step": 2, "content": "Cà rốt bào sợi mỏng"}, {"step": 3, "content": "Trộn đều gà, cà rốt với nước cốt chanh và chút muối"}]'::JSONB, 'SIDE_DISH', 25, 'EASY', 210),

-- Món 12: Bò xào hành tây cà chua
(1, 'Bò xào hành tây cà chua', 'Vị chua nhẹ của cà chua kết hợp thịt bò mềm', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 300, "unit": "g"}, {"id": 17, "name": "Hành tây", "qty": 1, "unit": "củ"}, {"id": 13, "name": "Cà chua", "qty": 2, "unit": "quả"}, {"id": 23, "name": "Nước mắm", "qty": 20, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Thái mỏng thịt bò, bổ múi cau hành tây và cà chua"}, {"step": 2, "content": "Xào thịt bò nhanh tay với lửa lớn rồi để riêng"}, {"step": 3, "content": "Xào hành tây và cà chua chín tới"}, {"step": 4, "content": "Cho thịt bò vào đảo lại, nêm mắm và tắt bếp"}]'::JSONB, 'MAIN_DISH', 20, 'EASY', 380),

-- Món 13: Đậu phụ sốt cà chua hành lá
(1, 'Đậu phụ sốt cà chua', 'Món ăn gia đình phổ biến', 
'[{"id": 7, "name": "Đậu phụ", "qty": 4, "unit": "miếng"}, {"id": 13, "name": "Cà chua", "qty": 3, "unit": "quả"}, {"id": 30, "name": "Hành lá", "qty": 2, "unit": "nhánh"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Rán vàng đậu phụ"}, {"step": 2, "content": "Đun cà chua với chút nước thành sốt sệt"}, {"step": 3, "content": "Cho đậu vào om cùng sốt trong 5 phút"}, {"step": 4, "content": "Rắc hành lá lên trên"}]'::JSONB, 'MAIN_DISH', 20, 'EASY', 260),

-- Món 14: Canh trứng cà chua
(1, 'Canh trứng cà chua', 'Nhanh gọn và đủ chất', 
'[{"id": 42, "name": "Trứng", "qty": 2, "unit": "quả"}, {"id": 13, "name": "Cà chua", "qty": 2, "unit": "quả"}, {"id": 30, "name": "Hành lá", "qty": 1, "unit": "nhánh"}, {"id": 21, "name": "Muối", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Xào cà chua mềm rồi thêm 500ml nước đun sôi"}, {"step": 2, "content": "Đánh tan trứng, đổ từ từ vào nồi nước đang sôi"}, {"step": 3, "content": "Nêm muối và hành lá rồi tắt bếp ngay"}]'::JSONB, 'SOUP', 10, 'EASY', 150),

-- Món 15: Cá hồi áp chảo sốt gừng
(1, 'Cá hồi áp chảo sốt gừng', 'Món ăn cao cấp bổ sung Omega-3', 
'[{"id": 4, "name": "Cá hồi", "qty": 250, "unit": "g"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 23, "name": "Nước mắm", "qty": 10, "unit": "ml"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Gừng thái sợi nhỏ"}, {"step": 2, "content": "Áp chảo cá hồi mỗi mặt 2 phút"}, {"step": 3, "content": "Phi thơm gừng với mắm rồi rưới lên cá"}]'::JSONB, 'MAIN_DISH', 15, 'MEDIUM', 320),

-- Món 16: Bún xào thịt bò hành tây
(1, 'Bún xào thịt bò', 'Bữa sáng nhanh gọn', 
'[{"id": 40, "name": "Bún tươi", "qty": 300, "unit": "g"}, {"id": 2, "name": "Thịt bò nạc", "qty": 150, "unit": "g"}, {"id": 17, "name": "Hành tây", "qty": 0.5, "unit": "củ"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Xào thịt bò với hành tây cho chín tới"}, {"step": 2, "content": "Cho bún vào chảo đảo nhẹ cùng gia vị"}, {"step": 3, "content": "Trình bày ra đĩa và dùng nóng"}]'::JSONB, 'MAIN_DISH', 15, 'EASY', 450),

-- Món 17: Trứng cuộn hành lá
(1, 'Trứng cuộn hành lá', 'Đơn giản nhưng đẹp mắt', 
'[{"id": 42, "name": "Trứng", "qty": 3, "unit": "quả"}, {"id": 30, "name": "Hành lá", "qty": 2, "unit": "nhánh"}, {"id": 21, "name": "Muối", "qty": 2, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Đánh tan trứng với hành lá và muối"}, {"step": 2, "content": "Đổ một lớp mỏng trứng vào chảo, cuộn dần lại"}, {"step": 3, "content": "Thái miếng vừa ăn"}]'::JSONB, 'SIDE_DISH', 10, 'EASY', 200),

-- Món 18: Canh cá hồi cà chua gừng
(1, 'Canh cá hồi gừng', 'Ấm bụng cho ngày lạnh', 
'[{"id": 4, "name": "Cá hồi", "qty": 200, "unit": "g"}, {"id": 13, "name": "Cà chua", "qty": 2, "unit": "quả"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 30, "name": "Hành lá", "qty": 1, "unit": "nhánh"}]'::JSONB,
'[{"step": 1, "content": "Cá hồi cắt miếng vuông nhỏ"}, {"step": 2, "content": "Đun sôi nước với gừng và cà chua"}, {"step": 3, "content": "Cho cá vào đun thêm 3 phút, rắc hành lá"}]'::JSONB, 'SOUP', 20, 'MEDIUM', 280),

-- Món 19: Đậu phụ hầm cà rốt
(1, 'Đậu phụ hầm cà rốt', 'Món hầm chay thanh đạm', 
'[{"id": 7, "name": "Đậu phụ", "qty": 3, "unit": "miếng"}, {"id": 12, "name": "Cà rốt", "qty": 1, "unit": "củ"}, {"id": 21, "name": "Muối", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Cắt miếng đậu phụ và cà rốt"}, {"step": 2, "content": "Cho vào nồi cùng chút nước và muối"}, {"step": 3, "content": "Hầm nhỏ lửa 15 phút cho cà rốt mềm"}]'::JSONB, 'MAIN_DISH', 25, 'EASY', 180),

-- Món 20: Ức gà áp chảo chanh gừng
(1, 'Gà áp chảo chanh gừng', 'Ức gà thơm mùi chanh gừng', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 300, "unit": "g"}, {"id": 43, "name": "Chanh", "qty": 0.5, "unit": "quả"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Ướp gà với gừng băm và cốt chanh"}, {"step": 2, "content": "Áp chảo gà với lửa vừa cho đến khi vàng đều 2 mặt"}]'::JSONB, 'MAIN_DISH', 20, 'EASY', 290),

-- Món 21: Ức gà sốt mắm tôm gừng
(1, 'Ức gà sốt mắm tôm gừng', 'Sự kết hợp độc đáo giữa ức gà và vị đậm đà của mắm tôm', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 400, "unit": "g"}, {"id": 36, "name": "Mắm tôm", "qty": 20, "unit": "ml"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 22, "name": "Đường", "qty": 10, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Thái gà miếng vuông, gừng băm nhỏ"}, {"step": 2, "content": "Pha hỗn hợp mắm tôm, đường, gừng và chút nước"}, {"step": 3, "content": "Xào gà săn lại rồi đổ hỗn hợp sốt vào om"}, {"step": 4, "content": "Đun đến khi sốt sệt lại bao quanh miếng gà"}]'::JSONB, 'MAIN_DISH', 25, 'MEDIUM', 310),

-- Món 22: Cá hồi kho tộ hành gừng
(1, 'Cá hồi kho tộ', 'Cá hồi kho đậm đà kiểu miền Tây', 
'[{"id": 4, "name": "Cá hồi", "qty": 300, "unit": "g"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}, {"id": 30, "name": "Hành lá", "qty": 2, "unit": "nhánh"}, {"id": 129, "name": "Tiêu", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Ướp cá với mắm, tiêu, gừng thái sợi"}, {"step": 2, "content": "Cho cá vào nồi đất, thêm ít nước"}, {"step": 3, "content": "Kho lửa nhỏ cho đến khi nước cạn còn 1/3"}, {"step": 4, "content": "Rắc hành lá và tiêu lên trên"}]'::JSONB, 'MAIN_DISH', 30, 'MEDIUM', 380),

-- Món 23: Bún bò Nam Bộ (giản lược)
(1, 'Bún bò xào hành tây', 'Món bún trộn khô thơm ngon', 
'[{"id": 40, "name": "Bún tươi", "qty": 400, "unit": "g"}, {"id": 2, "name": "Thịt bò nạc", "qty": 200, "unit": "g"}, {"id": 17, "name": "Hành tây", "qty": 1, "unit": "củ"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}, {"id": 23, "name": "Nước mắm", "qty": 15, "unit": "ml"}, {"id": 22, "name": "Đường", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Thái mỏng thịt bò, xào nhanh với hành tây"}, {"step": 2, "content": "Pha nước mắm chua ngọt với chanh và đường"}, {"step": 3, "content": "Cho bún vào tô, xếp bò lên trên"}, {"step": 4, "content": "Rưới nước mắm và trộn đều"}]'::JSONB, 'MAIN_DISH', 20, 'EASY', 420),

-- Món 24: Đậu phụ tẩm hành
(1, 'Đậu phụ tẩm hành', 'Món ăn giản dị nhưng cực trôi cơm', 
'[{"id": 7, "name": "Đậu phụ", "qty": 5, "unit": "miếng"}, {"id": 30, "name": "Hành lá", "qty": 5, "unit": "nhánh"}, {"id": 23, "name": "Nước mắm", "qty": 20, "unit": "ml"}, {"id": 24, "name": "Dầu ăn", "qty": 15, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Thái hành lá thật nhỏ, cho vào bát mắm pha loãng"}, {"step": 2, "content": "Rán vàng đậu phụ"}, {"step": 3, "content": "Gắp đậu vừa rán xong nhúng ngay vào bát mắm hành"}, {"step": 4, "content": "Xếp ra đĩa"}]'::JSONB, 'SIDE_DISH', 15, 'EASY', 190),

-- Món 25: Canh chua cá hồi cà rốt
(1, 'Canh chua cá hồi', 'Vị chua từ chanh và ngọt từ cá hồi', 
'[{"id": 4, "name": "Cá hồi", "qty": 200, "unit": "g"}, {"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"}, {"id": 13, "name": "Cà chua", "qty": 2, "unit": "quả"}, {"id": 12, "name": "Cà rốt", "qty": 1, "unit": "củ"}]'::JSONB,
'[{"step": 1, "content": "Nấu sôi nước, cho cà rốt và cà chua vào trước"}, {"step": 2, "content": "Cho cá hồi vào đun sôi lại tầm 3 phút"}, {"step": 3, "content": "Tắt bếp rồi mới vắt nước cốt chanh để không bị đắng"}, {"step": 4, "content": "Nêm mắm vừa ăn"}]'::JSONB, 'SOUP', 25, 'MEDIUM', 250),

-- Món 26: Trứng đúc đậu phụ hành lá
(1, 'Trứng đúc đậu phụ', 'Món ăn mềm mại, giàu protein', 
'[{"id": 42, "name": "Trứng", "qty": 3, "unit": "quả"}, {"id": 7, "name": "Đậu phụ", "qty": 1, "unit": "miếng"}, {"id": 30, "name": "Hành lá", "qty": 2, "unit": "nhánh"}, {"id": 21, "name": "Muối", "qty": 2, "unit": "g"}, {"id": 129, "name": "Tiêu", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Dằm nát đậu phụ, trộn đều với trứng và hành lá"}, {"step": 2, "content": "Nêm muối và tiêu"}, {"step": 3, "content": "Cho vào chảo chiên vàng đều hai mặt"}, {"step": 4, "content": "Cắt thành miếng tam giác đẹp mắt"}]'::JSONB, 'MAIN_DISH', 15, 'EASY', 230),

-- Món 27: Thịt bò hầm gừng  mắm tôm
(1, 'Bò kho mắm tôm gừng', 'Món hầm đậm đà, lạ miệng', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 500, "unit": "g"}, {"id": 36, "name": "Mắm tôm", "qty": 15, "unit": "ml"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 32, "name": "Đường", "qty": 10, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Thái bò miếng dày, ướp gừng và mắm tôm"}, {"step": 2, "content": "Xào săn bò rồi thêm nước ngập mặt thịt"}, {"step": 3, "content": "Hầm đến khi thịt mềm và nước sốt sánh lại"}, {"step": 4, "content": "Ăn kèm với bún tươi rất ngon"}]'::JSONB, 'MAIN_DISH', 60, 'HARD', 510),

-- Món 28: Salad cà chua hành tây chanh đường
(1, 'Salad hành tây cà chua', 'Món kèm chống ngán', 
'[{"id": 17, "name": "Hành tây", "qty": 1, "unit": "củ"}, {"id": 13, "name": "Cà chua", "qty": 2, "unit": "quả"}, {"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"}, {"id": 32, "name": "Đường", "qty": 15, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Hành tây thái mỏng ngâm nước đá cho bớt hăng"}, {"step": 2, "content": "Cà chua thái lát"}, {"step": 3, "content": "Trộn hỗn hợp nước cốt chanh, đường"}, {"step": 4, "content": "Đổ vào rau củ trộn đều"}]'::JSONB, 'APPETIZER', 10, 'EASY', 120),

-- Món 29: Ức gà rang gừng mắm
(1, 'Gà rang gừng', 'Món ăn truyền thống của gia đình Việt', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 400, "unit": "g"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 23, "name": "Nước mắm", "qty": 25, "unit": "ml"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Ức gà thái miếng vừa ăn, gừng thái sợi"}, {"step": 2, "content": "Phi thơm gừng với dầu ăn"}, {"step": 3, "content": "Cho gà vào xào săn, nêm mắm đậm vị"}, {"step": 4, "content": "Rang đến khi cháy cạnh thơm lừng"}]'::JSONB, 'MAIN_DISH', 20, 'EASY', 340),

-- Món 30: Bún đậu mắm tôm chanh đường
(1, 'Bún đậu mắm tôm đầy đủ', 'Nâng cấp từ món bún đậu cơ bản', 
'[{"id": 40, "name": "Bún tươi", "qty": 500, "unit": "g"}, {"id": 7, "name": "Đậu phụ", "qty": 4, "unit": "miếng"}, {"id": 36, "name": "Mắm tôm", "qty": 20, "unit": "ml"}, {"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"}, {"id": 32, "name": "Đường", "qty": 10, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Rán đậu phụ vàng giòn"}, {"step": 2, "content": "Pha mắm tôm với đường và nước cốt chanh, đánh bông lên"}, {"step": 3, "content": "Cắt bún và đậu ra đĩa"}, {"step": 4, "content": "Chấm kèm mắm tôm đã pha"}]'::JSONB, 'MAIN_DISH', 15, 'EASY', 450),

-- Món 31: Ức gà kho sả ớt
(1, 'Ức gà kho sả ớt', 'Món ăn đậm đà, cay nồng bắt cơm', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 400, "unit": "g"}, {"id": 31, "name": "Sả tươi", "qty": 3, "unit": "củ"}, {"id": 31, "name": "Ớt", "qty": 2, "unit": "quả"}, {"id": 23, "name": "Nước mắm", "qty": 20, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Gà thái miếng vừa ăn, sả và ớt băm nhỏ"}, {"step": 2, "content": "Phi thơm sả ớt với dầu ăn"}, {"step": 3, "content": "Cho gà vào xào săn, nêm mắm và chút đường"}, {"step": 4, "content": "Kho lửa nhỏ đến khi gà thấm vị và khô lại"}]'::JSONB, 'MAIN_DISH', 25, 'EASY', 320),

-- Món 32: Cá hồi sốt tiêu đen
(1, 'Cá hồi sốt tiêu đen', 'Vị tiêu thơm nồng quyện cùng cá hồi béo', 
'[{"id": 4, "name": "Cá hồi", "qty": 250, "unit": "g"}, {"id": 129, "name": "Tiêu", "qty": 10, "unit": "g"}, {"id": 23, "name": "Nước mắm", "qty": 10, "unit": "ml"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Áp chảo cá hồi chín tới rồi để riêng"}, {"step": 2, "content": "Giã dập tiêu, phi thơm với dầu ăn và mắm"}, {"step": 3, "content": "Rưới hỗn hợp sốt tiêu lên miếng cá"}, {"step": 4, "content": "Ăn kèm hành tây xào nếu thích"}]'::JSONB, 'MAIN_DISH', 15, 'MEDIUM', 350),

-- Món 33: Bún mắm tôm thịt bò (Biến tấu)
(1, 'Bún bò chấm mắm tôm', 'Sự kết hợp lạ miệng nhưng cực cuốn', 
'[{"id": 40, "name": "Bún tươi", "qty": 400, "unit": "g"}, {"id": 2, "name": "Thịt bò nạc", "qty": 200, "unit": "g"}, {"id": 36, "name": "Mắm tôm", "qty": 15, "unit": "ml"}, {"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"}]'::JSONB,
'[{"step": 1, "content": "Thịt bò luộc chín thái lát mỏng"}, {"step": 2, "content": "Pha mắm tôm với chanh, đường và ớt băm"}, {"step": 3, "content": "Xếp bún và bò ra đĩa"}, {"step": 4, "content": "Chấm bò và bún với mắm tôm"}]'::JSONB, 'MAIN_DISH', 20, 'EASY', 400),

-- Món 34: Canh bò hầm sả gừng
(1, 'Canh bò hầm sả gừng', 'Giải cảm và làm ấm cơ thể', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 300, "unit": "g"}, {"id": 31, "name": "Sả tươi", "qty": 2, "unit": "củ"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 21, "name": "Muối", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Sả đập dập, gừng thái lát, bò thái miếng vuông"}, {"step": 2, "content": "Đun sôi nước, cho sả và gừng vào trước"}, {"step": 3, "content": "Cho bò vào hầm lửa nhỏ 40 phút"}, {"step": 4, "content": "Nêm muối vừa ăn"}]'::JSONB, 'SOUP', 50, 'MEDIUM', 330),

-- Món 35: Đậu phụ xào sả ớt
(1, 'Đậu phụ xào sả ớt', 'Món chay bình dân nhưng đậm đà', 
'[{"id": 7, "name": "Đậu phụ", "qty": 4, "unit": "miếng"}, {"id": 19, "name": "Sả", "qty": 3, "unit": "củ"}, {"id": 31, "name": "Ớt", "qty": 1, "unit": "quả"}, {"id": 23, "name": "Nước mắm", "qty": 15, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Đậu phụ thái miếng nhỏ, rán vàng"}, {"step": 2, "content": "Băm nhỏ sả ớt và phi thơm"}, {"step": 3, "content": "Cho đậu đã rán vào đảo cùng sả ớt và mắm"}, {"step": 4, "content": "Đảo đến khi đậu thấm gia vị"}]'::JSONB, 'SIDE_DISH', 20, 'EASY', 220),

-- Món 36: Trứng chiên sả
(1, 'Trứng chiên sả ớt', 'Hương vị mới lạ cho món trứng quen thuộc', 
'[{"id": 42, "name": "Trứng", "qty": 3, "unit": "quả"}, {"id": 31, "name": "Sả tươi", "qty": 1, "unit": "củ"}, {"id": 30, "name": "Hành lá", "qty": 1, "unit": "nhánh"}, {"id": 21, "name": "Muối", "qty": 2, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Sả băm thật nhuyễn, hành lá thái nhỏ"}, {"step": 2, "content": "Đánh tan trứng với sả, hành và muối"}, {"step": 3, "content": "Chiên vàng đều hai mặt trên chảo dầu nóng"}]'::JSONB, 'SIDE_DISH', 10, 'EASY', 215),

-- Món 37: Salad cá hồi chanh sả
(1, 'Salad cá hồi tái chanh', 'Món khai vị tươi mát kiểu Thái', 
'[{"id": 4, "name": "Cá hồi", "qty": 200, "unit": "g"}, {"id": 43, "name": "Chanh", "qty": 2, "unit": "quả"}, {"id": 31, "name": "Sả tươi", "qty": 2, "unit": "củ"}, {"id": 19, "name": "Ớt", "qty": 1, "unit": "quả"}]'::JSONB,
'[{"step": 1, "content": "Cá hồi thái lát mỏng"}, {"step": 2, "content": "Sả thái lát mỏng như tờ giấy, ớt băm nhỏ"}, {"step": 3, "content": "Trộn cá với nước cốt chanh để 5 phút cho tái"}, {"step": 4, "content": "Thêm sả, ớt và chút đường vào trộn đều"}]'::JSONB, 'APPETIZER', 15, 'HARD', 240),

-- Món 38: Ức gà hầm cà rốt tiêu xanh
(1, 'Gà hầm cà rốt tiêu', 'Món hầm bổ dưỡng cho trẻ nhỏ', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 400, "unit": "g"}, {"id": 12, "name": "Cà rốt", "qty": 2, "unit": "củ"}, {"id": 129, "name": "Tiêu", "qty": 5, "unit": "g"}, {"id": 21, "name": "Muối", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Gà thái miếng, cà rốt cắt khoanh"}, {"step": 2, "content": "Cho gà và cà rốt vào nồi hầm với nước"}, {"step": 3, "content": "Nêm muối và thật nhiều tiêu"}, {"step": 4, "content": "Hầm đến khi cà rốt mềm nhừ"}]'::JSONB, 'SOUP', 35, 'MEDIUM', 290),

-- Món 39: Bún trộn mắm mặn hành phi
(1, 'Bún trộn mắm hành', 'Món ăn nhanh khi bận rộn', 
'[{"id": 40, "name": "Bún tươi", "qty": 400, "unit": "g"}, {"id": 30, "name": "Hành lá", "qty": 5, "unit": "nhánh"}, {"id": 23, "name": "Nước mắm", "qty": 20, "unit": "ml"}, {"id": 24, "name": "Dầu ăn", "qty": 20, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Làm mỡ hành bằng cách đổ dầu sôi vào hành lá thái nhỏ"}, {"step": 2, "content": "Pha mắm với đường và ớt"}, {"step": 3, "content": "Cho bún vào bát, rưới mỡ hành và nước mắm"}, {"step": 4, "content": "Trộn đều và thưởng thức"}]'::JSONB, 'MAIN_DISH', 5, 'EASY', 310),

-- Món 40: Bò xào sả ớt
(1, 'Bò xào sả ớt', 'Cực kỳ đưa cơm', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 300, "unit": "g"}, {"id": 31, "name": "Sả tươi", "qty": 4, "unit": "củ"}, {"id": 19, "name": "Ớt", "qty": 2, "unit": "quả"}, {"id": 23, "name": "Nước mắm", "qty": 15, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Thái mỏng thịt bò, băm nhỏ sả ớt"}, {"step": 2, "content": "Phi thơm sả ớt, cho bò vào xào lửa lớn"}, {"step": 3, "content": "Nêm mắm vừa ăn ngay khi bò còn tái"}, {"step": 4, "content": "Tắt bếp khi bò vừa chín tới"}]'::JSONB, 'MAIN_DISH', 15, 'EASY', 370),

-- Món 41: Bún cá hồi sả ớt (Món nước đậm đà)
(1, 'Bún cá hồi sả ớt', 'Sự kết hợp giữa vị béo của cá và mùi thơm của sả', 
'[{"id": 4, "name": "Cá hồi", "qty": 200, "unit": "g"}, {"id": 40, "name": "Bún tươi", "qty": 400, "unit": "g"}, {"id": 31, "name": "Sả tươi", "qty": 2, "unit": "củ"}, {"id": 19, "name": "Ớt", "qty": 1, "unit": "quả"}, {"id": 23, "name": "Nước mắm", "qty": 15, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Cá hồi thái miếng vừa ăn, áp chảo sơ với sả băm"}, {"step": 2, "content": "Nấu nước dùng với sả đập dập và ớt"}, {"step": 3, "content": "Cho bún ra bát, xếp cá lên và chan nước dùng"}, {"step": 4, "content": "Nêm thêm mắm cho vừa miệng"}]'::JSONB, 'MAIN_DISH', 25, 'MEDIUM', 380),

-- Món 42: Trứng hấp cà chua đậu phụ (Món mềm cho người già/trẻ em)
(1, 'Trứng hấp đậu phụ cà chua', 'Món hấp thanh đạm, giữ nguyên dưỡng chất', 
'[{"id": 42, "name": "Trứng", "qty": 3, "unit": "quả"}, {"id": 7, "name": "Đậu phụ", "qty": 1, "unit": "miếng"}, {"id": 13, "name": "Cà chua", "qty": 1, "unit": "quả"}, {"id": 21, "name": "Muối", "qty": 3, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Đậu phụ dằm nhuyễn, cà chua thái hạt lựu"}, {"step": 2, "content": "Đánh tan trứng với đậu, cà chua và muối"}, {"step": 3, "content": "Cho hỗn hợp vào bát, đem hấp cách thủy 15 phút"}]'::JSONB, 'SIDE_DISH', 20, 'EASY', 190),

-- Món 43: Bò xào gừng sả tiêu (Món nhậu hoặc ăn cơm)
(1, 'Bò xào ngũ vị', 'Thịt bò quyện mùi gừng, sả và tiêu nồng', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 300, "unit": "g"}, {"id": 20, "name": "Gừng", "qty": 0.5, "unit": "củ"}, {"id": 31, "name": "Sả tươi", "qty": 2, "unit": "củ"}, {"id": 129, "name": "Tiêu", "qty": 5, "unit": "g"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Thịt bò thái mỏng ướp với gừng, sả băm và tiêu"}, {"step": 2, "content": "Đun nóng dầu ăn, xào bò với lửa thật lớn"}, {"step": 3, "content": "Đảo nhanh tay trong 3-5 phút rồi tắt bếp"}]'::JSONB, 'MAIN_DISH', 15, 'EASY', 350),

-- Món 44: Salad cà rốt chanh đường mắm tôm (Kiểu nộm)
(1, 'Nộm cà rốt mắm tôm', 'Vị chua cay mặn ngọt đặc trưng', 
'[{"id": 12, "name": "Cà rốt", "qty": 2, "unit": "củ"}, {"id": 36, "name": "Mắm tôm", "qty": 10, "unit": "ml"}, {"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"}, {"id": 32, "name": "Đường", "qty": 15, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Cà rốt bào sợi, bóp muối rồi rửa sạch, để ráo"}, {"step": 2, "content": "Pha sốt trộn: mắm tôm, cốt chanh, đường và ớt"}, {"step": 3, "content": "Trộn sốt vào cà rốt và để thấm 10 phút"}]'::JSONB, 'APPETIZER', 15, 'MEDIUM', 110),

-- Món 45: Canh ức gà hầm cà chua hành lá
(1, 'Canh gà cà chua', 'Món canh nhẹ nhàng cho bữa tối', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 200, "unit": "g"}, {"id": 13, "name": "Cà chua", "qty": 2, "unit": "quả"}, {"id": 30, "name": "Hành lá", "qty": 1, "unit": "nhánh"}, {"id": 21, "name": "Muối", "qty": 5, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Gà thái miếng nhỏ, cà chua bổ múi cau"}, {"step": 2, "content": "Xào cà chua với dầu ăn, thêm nước vào đun sôi"}, {"step": 3, "content": "Cho gà vào nấu chín, nêm muối vừa ăn"}, {"step": 4, "content": "Rắc hành lá rồi tắt bếp"}]'::JSONB, 'SOUP', 15, 'EASY', 170),

-- Món 46: Bún trộn cá hồi áp chảo
(1, 'Bún trộn cá hồi healthy', 'Món ăn ít dầu mỡ, tốt cho tim mạch', 
'[{"id": 4, "name": "Cá hồi", "qty": 200, "unit": "g"}, {"id": 40, "name": "Bún tươi", "qty": 300, "unit": "g"}, {"id": 43, "name": "Chanh", "qty": 0.5, "unit": "quả"}, {"id": 23, "name": "Nước mắm", "qty": 10, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Cá hồi áp chảo chín vàng hai mặt, xé nhỏ"}, {"step": 2, "content": "Pha nước mắm chanh đường"}, {"step": 3, "content": "Cho bún vào bát, xếp cá lên và rưới nước mắm"}]'::JSONB, 'MAIN_DISH', 20, 'MEDIUM', 360),

-- Món 47: Đậu phụ sốt sả ớt mắm tôm
(1, 'Đậu phụ sốt mắm tôm sả', 'Hương vị bùng nổ, rất bắt cơm', 
'[{"id": 7, "name": "Đậu phụ", "qty": 4, "unit": "miếng"}, {"id": 36, "name": "Mắm tôm", "qty": 20, "unit": "ml"}, {"id": 31, "name": "Sả tươi ", "qty": 2, "unit": "củ"}, {"id": 19, "name": "Ớt", "qty": 1, "unit": "quả"}]'::JSONB,
'[{"step": 1, "content": "Đậu phụ rán vàng các mặt"}, {"step": 2, "content": "Phi thơm sả ớt, cho mắm tôm vào đun sôi nhẹ"}, {"step": 3, "content": "Cho đậu đã rán vào đảo đều cho thấm sốt"}]'::JSONB, 'MAIN_DISH', 15, 'EASY', 240),

-- Món 48: Bò hầm cà rốt tiêu đen (Nấu kỹ)
(1, 'Bò sốt tiêu cà rốt', 'Thịt bò mềm nhừ, vị tiêu cay ấm', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 500, "unit": "g"}, {"id": 12, "name": "Cà rốt", "qty": 2, "unit": "củ"}, {"id": 129, "name": "Tiêu", "qty": 10, "unit": "g"}, {"id": 32, "name": "Đường", "qty": 10, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Bò cắt miếng vuông, ướp với nhiều tiêu và đường"}, {"step": 2, "content": "Xào săn bò rồi hầm cùng cà rốt trong nồi áp suất hoặc 1 tiếng bếp thường"}, {"step": 3, "content": "Nêm mắm muối vừa ăn khi bò đã mềm"}]'::JSONB, 'MAIN_DISH', 60, 'HARD', 490),

-- Món 49: Trứng xào cà chua hành tây
(1, 'Trứng xào tổng hợp', 'Món ăn màu sắc, dễ làm', 
'[{"id": 42, "name": "Trứng", "qty": 3, "unit": "quả"}, {"id": 13, "name": "Cà chua", "qty": 1, "unit": "quả"}, {"id": 17, "name": "Hành tây", "qty": 0.5, "unit": "củ"}, {"id": 21, "name": "Muối", "qty": 2, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Hành tây thái nhỏ, cà chua bổ múi cau"}, {"step": 2, "content": "Xào hành tây và cà chua chín tới"}, {"step": 3, "content": "Đổ trứng vào đảo đều đến khi trứng chín kết dính"}]'::JSONB, 'SIDE_DISH', 10, 'EASY', 210),

-- Món 50: Nước chanh sả gừng đường (Thức uống thanh lọc)
(1, 'Nước thanh lọc chanh sả gừng', 'Thức uống tốt cho sức khỏe mỗi sáng', 
'[{"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"}, {"id": 31, "name": "Sả tươi", "qty": 2, "unit": "củ"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 22, "name": "Đường", "qty": 30, "unit": "g"}]'::JSONB,
'[{"step": 1, "content": "Đun sôi sả và gừng với 500ml nước trong 10 phút"}, {"step": 2, "content": "Để nguội bớt rồi pha đường và vắt chanh"}, {"step": 3, "content": "Dùng nóng hoặc thêm đá đều ngon"}]'::JSONB, 'DRINK', 15, 'EASY', 120),
--Món id 56: Cá kho gừng
(1, 'Cá kho gừng', 'Món cá kho mang nhiều dinh dưỡng cho ngày mới', 
'[{"id": 20, "name": "Gừng", "qty": 3, "unit": "g"}, {"id": 134, "name": "Cá", "qty": 1, "unit": "con"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Làm sạch cá qua nước"}, {"step": 2, "content": "Sơ chế bằng dao mổ"}, {"step": 3, "content": "Rửa sạch lại với nước" }, {"step": 4, "content": "Cho cá vào đun kèm với mắm và gừng"}, {"step": 5, "content": "Đun lửa nhỏ 20 phút"}]'::JSONB, 'MAIN_DISH', 40, 'EASY', 350);


select * from recipe;
select * from ingredient;
--test
UPDATE recipe SET status = 'PENDING' WHERE recipe_id IN (49, 50);
--TESST

--Map du lieu cac mon an va nguyen lieu
INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id) VALUES 
(1,1), (1,23), -- Món 1
(2,2), (2,17), (2,23), -- Món 2
(3,2), (3,20), (3, 23),         -- Món 3
(4,42), (4,30), (4,21) ,        -- Món 4
(5,4), (5,43), (5, 24)  ,      -- Món 5
(6,2), (6,12), (6, 21)   ,      -- Món 6
(7,12), (7,43),        -- Món 7
(8,43), (8,20),        -- Món 8
(9,7), (9, 24),               -- Món 9
(10,7), (10,24), (10, 36), (10, 40),      -- Món 10
(11, 1), (11,12), (11, 43),
(12,2), (12, 17) ,(12, 13), (12,23),
(13, 7), (13, 30), (13, 24),
(14, 42), (14, 13), (14, 21),(14, 30),
(15, 4), (15, 20), (15, 24), (15, 23),
(16, 40), (16, 2), (16, 17), (16, 24),
(17, 42), (17, 30), (17, 21),
(18, 4), (18, 13),(18, 20), (18, 30),
(19, 7),(19, 12),(19, 21),
(20, 1),(20, 43),(20, 20), (20, 24),
(21, 1), (21, 36),(21, 20), (21, 22),
(22, 4),(22, 20), (22, 23), (22, 30), (22, 129),
(23, 40), (23, 2),(23, 17), (23, 24), (23, 23),(23, 22),  
(24, 7), (24, 30), (24, 23), (24, 24),
(25, 4), (25, 43), (25, 13), (25, 12),
(26, 42),(26, 7), (26, 30), (26, 21), (26, 129),
(27, 2), (27, 36), (27, 20), (27, 32),
(28, 17), (28, 13), (28, 43), (28,32),
(29, 1), (29, 20), (29, 23), (29, 24),
(30, 40), (30, 7), (30, 36), (30, 43), (30, 32),
(31, 1),(31, 31), (31, 30), (31, 23),
(32, 4), (32, 129), (32, 23), (32, 24),
(33, 40), (33, 2), (33, 36), (33, 43),
(34, 2), (34, 31), (34, 20), (34, 21),
(35, 7), (35, 19), (35, 31), (35, 23),
(36, 42), (36, 31), (36, 30), (36, 21),
(37, 4), (37, 43), (37, 19), (37, 31),
(38, 1), (38, 12), (38, 129), (38, 21),
(39, 40), (39, 30), (39, 23), (39, 24),
(40, 2),(40, 31), (40, 19), (40, 23),
(41, 4),(41, 40), (41, 31), (41, 19), (41, 23),
(42, 42),(42, 7), (42, 13), (42, 21),
(43, 2), (43, 20), (43, 31), (43, 129), (43, 24),
(44, 12), (44, 36), (44, 43), (44, 32),
(45, 1), (45, 13), (45, 30), (45, 21),
(46, 4),(46, 40), (46, 43), (46, 23),
(47, 7), (47, 36), (47, 19), (47, 31),
(48, 2), (48, 12), (48, 129), (48, 32),
(49, 42), (49, 13), (49, 17), (49, 21),
(50, 43), (50, 31), (50, 20), (50, 22);



select * from recipe_ingredient_map;
-- 10. MEAL SET
INSERT INTO meal_set (name, target_calories, meal_type, user_id, goal_type) values
('Thực đơn 1', 1500, 'DAILY', 2, 'LOSE_WEIGHT'), ('Thực đơn 2', 2500, 'DAILY', 4, 'GAIN_WEIGHT'),
('Thực đơn 3', 1800, 'DAILY', 1, 'MAINTAIN'), ('Thực đơn 4', 700, 'LUNCH', 3, 'MAINTAIN'),
('Thực đơn 5', 500, 'BREAKFAST', 5, 'MAINTAIN'), ('Thực đơn 6', 1600, 'DAILY', 7, 'MAINTAIN'),
('Thực đơn 7', 1400, 'DAILY', 6, 'LOSE_WEIGHT'), ('Thực đơn 8', 400, 'DINNER', 8, 'LOSE_WEIGHT'),
('Thực đơn 9', 3000, 'DAILY', 9, 'GAIN_WEIGHT'), ('Thực đơn 10', 1200, 'DAILY', 11, 'LOSE_WEIGHT'),
('Thực đơn 11', 2000, 'DAILY', 10, 'MAINTAIN'), ('Thực đơn 12', 1500, 'DAILY', 12, 'LOSE_WEIGHT'),
('Thực đơn 13', 2200, 'DAILY', 14, 'GAIN_WEIGHT'), ('Thực đơn 14', 300, 'SNACK', 15, 'MAINTAIN'),
('Thực đơn 15', 2800, 'DAILY', 18, 'GAIN_WEIGHT'), ('Thực đơn 16', 1400, 'DAILY', 16, 'LOSE_WEIGHT'),
('Thực đơn 17', 1900, 'DAILY', 20, 'MAINTAIN'), ('Thực đơn 18', 1800, 'DAILY', 21, 'MAINTAIN'),
('Thực đơn 19', 1700, 'DAILY', 22, 'MAINTAIN'), ('Thực đơn 20', 2500, 'DINNER', 23, 'MAINTAIN'),
('Thực đơn 21', 2000, 'LUNCH', 24, 'MAINTAIN'), ('Thực đơn 22', 1800, 'DAILY', 1, 'MAINTAIN'),
('Thực đơn 23', 1450, 'DAILY', 2, 'LOSE_WEIGHT'), ('Thực đơn 24', 2600, 'DAILY', 4, 'GAIN_WEIGHT'),
('Thực đơn 25', 1500, 'DAILY', 3, 'MAINTAIN'), ('Thực đơn 26', 600, 'BREAKFAST', 14, 'GAIN_WEIGHT'),
('Thực đơn 27', 500, 'DINNER', 16, 'LOSE_WEIGHT'), ('Thực đơn 28', 1700, 'DAILY', 19, 'MAINTAIN'),
('Thực đơn 29', 2100, 'DAILY', 25, 'GAIN_WEIGHT'), ('Thực đơn 30', 2200, 'DAILY', 30, 'MAINTAIN'), 
('Thực đơn 31', 350, 'BREAKFAST', 2, 'LOSE_WEIGHT'),('Thực đơn 32', 600, 'DINNER', 3, 'MAINTAIN');

select * from meal_set;

-- 11. MEAL SET RECIPE:
INSERT INTO meal_set_recipe (meal_set_id, recipe_id) VALUES
-- Nhóm Thực đơn 1 - 5: Tập trung ức gà & healthy
(1, 1), (1, 11), (1, 14),   -- Ức gà, Salad gà cà rốt, Canh trứng cà chua
(2, 20), (2, 21), (2, 29),  -- Gà áp chảo, Gà sốt mắm tôm, Gà rang gừng
(3, 31), (3, 38), (3, 45),  -- Gà kho sả ớt, Gà hầm cà rốt, Canh gà cà chua
(4, 1), (4, 7), (4, 8),      -- Ức gà luộc, Salad cà rốt, Nước chanh gừng
(5, 20), (5, 42), (5, 50),  -- Gà chanh gừng, Trứng hấp đậu phụ, Nước thanh lọc

-- Nhóm Thực đơn 6 - 10: Chuyên đề Thịt bò
(6, 2), (6, 12), (6, 28),   -- Bò xào hành tây, Bò xào cà chua, Salad hành tây
(7, 3), (7, 6), (7, 34),    -- Bò xào gừng, Bò hầm cà rốt, Canh bò hầm sả
(8, 16), (8, 23), (8, 40),  -- Bún xào bò, Bún bò Nam Bộ, Bò xào sả ớt
(9, 27), (9, 43), (9, 48),  -- Bò kho mắm tôm, Bò xào ngũ vị, Bò hầm tiêu đen
(10, 2), (10, 14), (10, 49),-- Bò xào hành tây, Canh trứng, Trứng xào tổng hợp

-- Nhóm Thực đơn 11 - 15: Chuyên đề Cá hồi & Sang trọng
(11, 4), (11, 5), (11, 15), -- Cá hồi áp chảo, Cá sốt chanh, Cá sốt gừng
(12, 18), (12, 22), (12, 25),-- Canh cá gừng, Cá hồi kho tộ, Canh chua cá hồi
(13, 32), (13, 37), (13, 41),-- Cá hồi tiêu đen, Salad cá tái chanh, Bún cá hồi
(14, 46), (14, 5), (14, 18), -- Bún cá hồi áp chảo, Cá áp chảo, Canh cá hồi
(15, 22), (15, 28), (15, 8), -- Cá hồi kho, Salad hành tây, Nước chanh gừng

-- Nhóm Thực đơn 16 - 20: Chuyên đề Đậu phụ (Ăn chay nhẹ nhàng)
(16, 9), (16, 13), (16, 24), -- Đậu rán, Đậu sốt cà chua, Đậu tẩm hành
(17, 19), (17, 26), (17, 35),-- Đậu hầm cà rốt, Trứng đúc đậu, Đậu xào sả ớt
(18, 47), (18, 42), (18, 13),-- Đậu sốt mắm tôm, Trứng hấp đậu, Đậu phụ sốt cà
(19, 9), (19, 7), (19, 14),  -- Đậu rán, Salad cà rốt, Canh trứng
(20, 35), (20, 47), (20, 19),-- Đậu xào sả ớt, Đậu sốt mắm, Đậu hầm cà rốt

-- Nhóm Thực đơn 21 - 25: Chuyên đề Bún & Món cuốn
(21, 10), (21, 30), (21, 39),-- Bún đậu mắm tôm, Bún đậu đầy đủ, Bún trộn mỡ hành
(22, 16), (22, 23), (22, 33),-- Bún bò hành tây, Bún bò trộn, Bún bò mắm tôm
(23, 41), (23, 46), (23, 40),-- Bún cá hồi sả, Bún cá hồi healthy, Bò xào sả ớt
(24, 10), (24, 33), (24, 36),-- Bún đậu, Bún bò mắm tôm, Trứng chiên sả
(25, 39), (25, 24), (25, 14),-- Bún trộn mỡ hành, Đậu tẩm hành, Canh trứng

-- Nhóm Thực đơn 26 - 32: Mix tổng hợp
(26, 29), (26, 17), (26, 14),-- Gà rang gừng, Trứng cuộn hành, Canh trứng
(27, 43), (27, 44), (27, 18),-- Bò ngũ vị, Nộm cà rốt mắm tôm, Canh cá hồi
(28, 11), (28, 26), (28, 34),-- Salad gà cà rốt, Trứng đúc đậu, Canh bò hầm
(29, 32), (29, 35), (29, 25),-- Cá hồi tiêu đen, Đậu xào sả, Canh chua cá hồi
(30, 48), (30, 49), (30, 50),-- Bò sốt tiêu, Trứng xào tổng hợp, Nước thanh lọc
(31, 21), (31, 36), (31, 45),-- Gà sốt mắm tôm, Trứng chiên sả, Canh gà
(32, 27), (32, 28), (32, 39);-- Bò kho mắm tôm, Salad hành tây, Bún trộn



select * from meal_set_recipe;
-- 12. RATING
INSERT INTO rating (user_id, recipe_id, score, comment) VALUES
(1, 2, 5, 'Món này rất ngon, nêm nếm vừa miệng và dễ làm.'),
(2, 1, 4, 'Hương vị ổn, phù hợp cho bữa tối nhẹ.'),
(3, 5, 5, 'Cá mềm, thơm, gia đình mình rất thích.'),
(4, 7, 4, 'Thanh mát, dễ ăn, hợp khi cần món ít dầu mỡ.'),
(5, 3, 3, 'Món tạm ổn, cần đậm vị hơn một chút.'),
(6, 10, 4, 'Phần nước chấm ngon, món ăn khá tròn vị.'),
(7, 8, 5, 'Dễ làm, nguyên liệu đơn giản và tốt cho sức khỏe.'),
(8, 2, 5, 'Thịt mềm, xào vừa chín tới, rất đưa cơm.'),
(9, 4, 2, 'Vị chưa hợp khẩu vị của mình.'),
(10, 6, 5, 'Món hầm ngon, thịt mềm và thơm.'),
(11, 9, 4, 'Giòn bên ngoài, mềm bên trong, khá ngon.'),
(12, 5, 5, 'Món này dễ làm và trình bày đẹp mắt.'),
(13, 1, 4, 'Đơn giản, nhanh gọn, phù hợp ngày bận rộn.'),
(14, 3, 5, 'Mùi gừng thơm, vị đậm đà, rất hợp cơm nóng.'),
(15, 4, 3, 'Khá ổn nhưng hơi nhạt so với khẩu vị.'),
(16, 10, 5, 'Đầy đủ thành phần, ăn no và ngon miệng.'),
(17, 8, 4, 'Món nước thanh, dễ uống và dễ tiêu.'),
(18, 2, 5, 'Cách làm rõ ràng, thành phẩm rất ổn.'),
(19, 5, 5, 'Cá thơm, không bị khô, vị rất hài hòa.'),
(20, 6, 4, 'Món hầm đậm vị, ăn kèm cơm rất hợp.'),
(21, 7, 5, 'Món salad tươi, vị chua nhẹ rất dễ ăn.'),
(22, 1, 5, 'Món cơ bản nhưng ngon, phù hợp chế độ ăn lành mạnh.'),
(23, 9, 4, 'Đậu rán vàng đều, ăn nóng rất ngon.'),
(24, 3, 5, 'Món xào thơm, vị cân bằng và bắt cơm.'),
(25, 10, 5, 'Bún đậu chuẩn vị, ăn rất cuốn.'),
(26, 4, 4, 'Trứng mềm, béo vừa phải, dễ chế biến.'),
(27, 6, 5, 'Thịt bò hầm mềm, nước dùng ngon.'),
(28, 8, 4, 'Món uống đơn giản, hợp khi trời lạnh.'),
(29, 2, 5, 'Thịt bò xào ngon, hành tây giữ được độ giòn.'),
(30, 5, 4, 'Món cá áp chảo khá ổn, dễ làm tại nhà.');


-- 13. FAVORITE RECIPE
INSERT INTO favorite_recipe (user_id, recipe_id) VALUES
(1, 1), (1, 2), (2, 3), (2, 4), (3, 5), (3, 6), (4, 7), (4, 8), (5, 9), (5, 10),
(6, 1), (6, 2), (7, 2), (7, 3), (8, 1), (8, 3), (9, 3), (9, 9), (10, 1), (10, 2)


-- 14. PAYMENT
INSERT INTO payment (user_id, plan_id, amount, internal_reference, transaction_code, status, paid_at) VALUES        
(1, 1, 20000, 'REF_T1', 'T1', 'SUCCESS', NOW()), (2, 2, 59000, 'REF_T2', 'T2', 'SUCCESS', NOW()),
(3, 3, 599000, 'REF_T3', 'T3', 'SUCCESS', NOW()), (4, 1, 20000, 'REF_T4', 'T4', 'SUCCESS', NOW()),
(5, 2, 59000, 'REF_T5', 'T5', 'SUCCESS', NOW()), (6, 1, 20000, 'REF_T6', 'T6', 'SUCCESS', NOW()),
(7, 3, 599000, 'REF_T7', 'T7', 'SUCCESS', NOW()), (8, 2, 59000, 'REF_T8', 'T8', 'SUCCESS', NOW()),
(9, 1, 20000, 'REF_T9', 'T9', 'SUCCESS', NOW()), (10, 2, 59000, 'REF_T10', 'T10', 'SUCCESS', NOW()),
(11, 1, 20000, 'REF_T11', 'T11', 'SUCCESS', NOW()), (12, 1, 20000, 'REF_T12', 'T12', 'SUCCESS', NOW()),
(13, 1, 20000, 'REF_T13', 'T13', 'SUCCESS', NOW()), (14, 2, 59000, 'REF_T14', 'T14', 'SUCCESS', NOW()),
(15, 3, 599000, 'REF_T15', 'T15', 'SUCCESS', NOW()), (16, 1, 20000, 'REF_T16', 'T16', 'SUCCESS', NOW()),
(17, 2, 59000, 'REF_T17', 'T17', 'SUCCESS', NOW()), (18, 1, 20000, 'REF_T18', 'T18', 'SUCCESS', NOW()),
(19, 2, 59000, 'REF_T19', 'T19', 'SUCCESS', NOW()), (20, 1, 20000, 'REF_T20', 'T20', 'SUCCESS', NOW()),
(21, 3, 599000, 'REF_T21', 'T21', 'SUCCESS', NOW()), (22, 1, 20000, 'REF_T22', 'T22', 'SUCCESS', NOW()),
(23, 2, 59000, 'REF_T23', 'T23', 'SUCCESS', NOW()), (24, 1, 20000, 'REF_T24', 'T24', 'SUCCESS', NOW()),
(25, 2, 59000, 'REF_T25', 'T25', 'SUCCESS', NOW()), (26, 1, 20000, 'REF_T26', 'T26', 'SUCCESS', NOW()),
(27, 3, 599000, 'REF_T27', 'T27', 'SUCCESS', NOW()), (28, 1, 20000, 'REF_T28', 'T28', 'SUCCESS', NOW()),
(29, 2, 59000, 'REF_T29', 'T29', 'SUCCESS', NOW()), (30, 1, 20000, 'REF_T30', 'T30', 'SUCCESS', NOW());

-- 15. PREMIUM HISTORY
INSERT INTO user_premium_history (user_id, plan_id, payment_id, start_date, end_date)
SELECT 
    p.user_id, 
    p.plan_id, 
    p.payment_id, 
    p.paid_at, 
    p.paid_at + (pl.duration_days || ' days')::interval 
FROM payment p
JOIN premium_plan pl ON p.plan_id = pl.plan_id
WHERE p.status = 'SUCCESS';

SELECT p.payment_id,
      u.email,
         p.amount,
         p.status, -- Đây chính là trạng thái bạn cần xem (PENDING hoặc SUCCESS)
         p.internal_reference as ma_chuyen_khoan,
         p.paid_at as ngay_thanh_toan
     FROM payment p
     JOIN app_user u ON p.user_id = u.user_id
   ORDER BY p.create_at DESC;
