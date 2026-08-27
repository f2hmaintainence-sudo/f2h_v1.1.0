import 'package:flutter/material.dart';
import 'cow_loading_widget.dart';

class ScrollingItemsLoader extends StatelessWidget {
  final String text;
  const ScrollingItemsLoader({
    this.text = 'Getting your F2H Fresh ready',
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return CowLoadingWidget(
      size: 140,
      message: text,
    );
  }
}
