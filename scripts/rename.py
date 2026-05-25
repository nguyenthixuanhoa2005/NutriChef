import os

def rename_files(folder_path, new_base_name):
    if not os.path.exists(folder_path):
        print(f"❌ Lỗi: Đường dẫn không tồn tại.")
        return

    valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')
    
    # Lấy danh sách file
    try:
        files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(valid_extensions)])
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        return

    if not files:
        print("⚠️ Không có ảnh nào.")
        return

    # Tính toán cần bao nhiêu số 0 dựa trên tổng số file
    # Ví dụ: 100 file -> cần 3 số (001), 10 file -> cần 2 số (01)
    digits = len(str(len(files))) 

    print(f"\n🔍 Tìm thấy {len(files)} ảnh.")
    print("-" * 40)
    print("DEMO:")
    
    # PREVIEW
    for i, filename in enumerate(files[:3], start=1):
        ext = os.path.splitext(filename)[1]
        # LOGIC CHÍNH Ở ĐÂY:
        new_name = f"{new_base_name}_{str(i).zfill(digits)}{ext}" 
        print(f"   📄 {filename}  --->  ✅ {new_name}")
    
    print("-" * 40)
    confirm = input("❓ Nhập 'y' để đổi tên: ").lower()
    
    if confirm == 'y':
        count = 0
        for i, filename in enumerate(files, start=1):
            old_path = os.path.join(folder_path, filename)
            ext = os.path.splitext(filename)[1]
            
            # TẠO TÊN MỚI
            new_name = f"{new_base_name}_{str(i).zfill(digits)}{ext}"
            new_path = os.path.join(folder_path, new_name)

            try:
                os.rename(old_path, new_path)
                count += 1
            except Exception as e:
                print(f"❌ Lỗi: {e}")
        print(f"🎉 Xong! Đã đổi {count} file.")
    else:
        print("⛔ Đã hủy.")

if __name__ == "__main__":
    # Cách nhập đường dẫn: Chuột phải vào folder -> Copy as path -> Paste vào đây
    path_input = input("Paste đường dẫn folder vào đây: ").strip('"')
    name_input = input("Nhập từ khóa (ví dụ: my_trip): ")
    rename_files(path_input, name_input)