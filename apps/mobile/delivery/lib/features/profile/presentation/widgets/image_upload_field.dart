import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class ImageUploadField extends StatefulWidget {
  final String label;
  final String? initialImageUrl;
  final File? selectedFile;
  final ValueChanged<File?> onImageSelected;
  final double height;

  const ImageUploadField({
    super.key,
    required this.label,
    this.initialImageUrl,
    this.selectedFile,
    required this.onImageSelected,
    this.height = 140,
  });

  @override
  State<ImageUploadField> createState() => _ImageUploadFieldState();
}

class _ImageUploadFieldState extends State<ImageUploadField> {
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage(ImageSource source) async {
    try {
      final pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1080,
        imageQuality: 85,
      );
      if (pickedFile != null) {
        widget.onImageSelected(File(pickedFile.path));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to pick image: $e'), backgroundColor: kRed),
      );
    }
  }

  void _showImageSourceActionSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: kSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext context) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt_rounded, color: kPrimary),
                title: const Text('Camera', style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_rounded, color: kPrimary),
                title: const Text('Gallery', style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.gallery);
                },
              ),
              if (widget.selectedFile != null)
                ListTile(
                  leading: const Icon(Icons.delete_rounded, color: kRed),
                  title: const Text('Remove Photo', style: TextStyle(color: kRed, fontWeight: FontWeight.bold)),
                  onTap: () {
                    Navigator.pop(context);
                    widget.onImageSelected(null);
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: kTextMid,
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () => _showImageSourceActionSheet(context),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: widget.height,
            width: double.infinity,
            decoration: BoxDecoration(
              color: kBgDeep,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: kBorder),
            ),
            child: widget.selectedFile != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(11),
                    child: Image.file(
                      widget.selectedFile!,
                      fit: BoxFit.cover,
                      width: double.infinity,
                    ),
                  )
                : widget.initialImageUrl != null && widget.initialImageUrl!.isNotEmpty
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(11),
                        child: Image.network(
                          widget.initialImageUrl!,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          errorBuilder: (context, error, stackTrace) {
                            return const Center(child: Icon(Icons.broken_image_rounded, color: kMuted, size: 40));
                          },
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.add_photo_alternate_rounded, color: kPrimary, size: 36),
                          const SizedBox(height: 8),
                          Text(
                            'Tap to upload ${widget.label}',
                            style: const TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
          ),
        ),
      ],
    );
  }
}
