extension StringExtension on String {
  String toTitleCase() {
    if (isEmpty) return this;
    final lower = toLowerCase().trim();
    if (lower == 'groundnutoil') return 'Groundnut Oil';
    if (lower == 'a2_cow_milk') return 'A2 Cow Milk';
    if (lower == 'a2_cow_ghee') return 'A2 Cow Ghee';
    
    return replaceAll('_', ' ').split(' ').map((word) {
      if (word.isEmpty) return '';
      if (word.toLowerCase() == 'a2') return 'A2';
      return word[0].toUpperCase() + word.substring(1);
    }).join(' ');
  }
}
