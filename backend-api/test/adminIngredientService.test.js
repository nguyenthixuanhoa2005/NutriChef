// Unit test cho adminIngredientService — chức năng thêm nguyên liệu (admin)
const {
    addIngredient,
    VALID_INGREDIENT_TYPES,
    ADD_INGREDIENT_QUERY,
    INGREDIENT_STATUS_ACTIVE,
} = require('../src/services/adminIngredientService');

describe('adminIngredientService', () => {
    describe('addIngredient', () => {

        // ─── Kiểm tra validation ───────────────────────────────────────────────

        test('Lỗi 400 khi thiếu name', async () => {
            const dbMock = { query: jest.fn() };

            await expect(addIngredient(dbMock, { type: 'VEGETABLE' })).rejects.toMatchObject({
                statusCode: 400,
                message: 'Ten va loai nguyen lieu la bat buoc',
            });

            expect(dbMock.query).not.toHaveBeenCalled();
        });

        test('Lỗi 400 khi thiếu type', async () => {
            const dbMock = { query: jest.fn() };

            await expect(addIngredient(dbMock, { name: 'Cà rốt' })).rejects.toMatchObject({
                statusCode: 400,
                message: 'Ten va loai nguyen lieu la bat buoc',
            });

            expect(dbMock.query).not.toHaveBeenCalled();
        });

        test('Lỗi 400 khi thiếu cả name lẫn type', async () => {
            const dbMock = { query: jest.fn() };

            await expect(addIngredient(dbMock, {})).rejects.toMatchObject({
                statusCode: 400,
                message: 'Ten va loai nguyen lieu la bat buoc',
            });

            expect(dbMock.query).not.toHaveBeenCalled();
        });

        test('Lỗi 400 khi type không nằm trong danh sách hợp lệ', async () => {
            const dbMock = { query: jest.fn() };

            await expect(
                addIngredient(dbMock, { name: 'Cà rốt', type: 'INVALID_TYPE' })
            ).rejects.toMatchObject({
                statusCode: 400,
                message: 'Loai nguyen lieu khong hop le',
            });

            expect(dbMock.query).not.toHaveBeenCalled();
        });

        // ─── Kiểm tra gọi DB khi input hợp lệ ────────────────────────────────

        test('Thêm nguyên liệu thành công với đầy đủ thông tin', async () => {
            const newIngredient = {
                ingredient_id: 10,
                name: 'Cà rốt',
                type: 'VEGETABLE',
                image_url: 'https://example.com/carrot.jpg',
                is_common: true,
                keywords: 'carrot,ca rot',
                status: INGREDIENT_STATUS_ACTIVE,
            };

            const dbMock = {
                query: jest.fn().mockResolvedValue({ rows: [newIngredient] }),
            };

            const result = await addIngredient(dbMock, {
                name: '  Cà rốt  ',
                type: 'VEGETABLE',
                image_url: 'https://example.com/carrot.jpg',
                is_common: true,
                keywords: '  carrot,ca rot  ',
            });

            // Phải gọi db.query đúng 1 lần
            expect(dbMock.query).toHaveBeenCalledTimes(1);

            // Kiểm tra query SQL và tham số truyền vào
            expect(dbMock.query).toHaveBeenCalledWith(ADD_INGREDIENT_QUERY, [
                'Cà rốt',                            // name đã trim
                'VEGETABLE',
                'https://example.com/carrot.jpg',
                true,                                // Boolean(is_common)
                'carrot,ca rot',                     // keywords đã trim
                INGREDIENT_STATUS_ACTIVE,
            ]);

            // Kết quả trả về là hàng ingredient mới
            expect(result).toEqual(newIngredient);
        });

        test('Thêm nguyên liệu thành công chỉ với name và type (các trường khác là null/false)', async () => {
            const newIngredient = {
                ingredient_id: 11,
                name: 'Muối',
                type: 'SPICE',
                image_url: null,
                is_common: false,
                keywords: null,
                status: INGREDIENT_STATUS_ACTIVE,
            };

            const dbMock = {
                query: jest.fn().mockResolvedValue({ rows: [newIngredient] }),
            };

            const result = await addIngredient(dbMock, { name: 'Muối', type: 'SPICE' });

            expect(dbMock.query).toHaveBeenCalledTimes(1);
            expect(dbMock.query).toHaveBeenCalledWith(ADD_INGREDIENT_QUERY, [
                'Muối',
                'SPICE',
                null,   // image_url không truyền → null
                false,  // is_common không truyền → Boolean(undefined) = false
                null,   // keywords không truyền → null
                INGREDIENT_STATUS_ACTIVE,
            ]);

            expect(result).toEqual(newIngredient);
        });

        // ─── Kiểm tra toàn bộ các type hợp lệ ────────────────────────────────

        test.each(VALID_INGREDIENT_TYPES)(
            'Type "%s" là hợp lệ và gọi db.query thành công',
            async (type) => {
                const dbMock = {
                    query: jest.fn().mockResolvedValue({
                        rows: [{ ingredient_id: 1, name: 'Test', type, status: INGREDIENT_STATUS_ACTIVE }],
                    }),
                };

                await expect(
                    addIngredient(dbMock, { name: 'Test', type })
                ).resolves.toBeDefined();

                expect(dbMock.query).toHaveBeenCalledTimes(1);
            }
        );

        // ─── Kiểm tra lỗi từ DB được ném ra đúng ─────────────────────────────

        test('Ném lỗi khi db.query thất bại (ví dụ: trùng tên)', async () => {
            const dbError = new Error('unique constraint violated');
            const dbMock = {
                query: jest.fn().mockRejectedValue(dbError),
            };

            await expect(
                addIngredient(dbMock, { name: 'Cà rốt', type: 'VEGETABLE' })
            ).rejects.toThrow('unique constraint violated');

            expect(dbMock.query).toHaveBeenCalledTimes(1);
        });
    });
});
