import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/network/network_bloc.dart';
import 'package:f2h_customer/core/network/network_state.dart';

class NetworkOverlay extends StatefulWidget {
  final Widget child;
  const NetworkOverlay({super.key, required this.child});

  @override
  State<NetworkOverlay> createState() => _NetworkOverlayState();
}

class _NetworkOverlayState extends State<NetworkOverlay> {
  bool _isOffline = false;
  bool _showOnline = false;

  @override
  Widget build(BuildContext context) {
    return BlocListener<NetworkBloc, NetworkState>(
      listener: (context, state) {
        if (state is NetworkOffline) {
          setState(() {
            _isOffline = true;
            _showOnline = false;
          });
        } else if (state is NetworkOnline) {
          if (_isOffline) {
            // transitioned from offline to online
            setState(() {
              _isOffline = false;
              _showOnline = true;
            });
            // hide online banner after 3 seconds
            Future.delayed(const Duration(seconds: 3), () {
              if (mounted) {
                setState(() {
                  _showOnline = false;
                });
              }
            });
          } else {
            // initial online state, don't show banner
            setState(() {
              _isOffline = false;
              _showOnline = false;
            });
          }
        }
      },
      child: Stack(
        children: [
          widget.child,
          // Banner overlay
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AnimatedSlide(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              offset: (_isOffline || _showOnline) ? const Offset(0, 0) : const Offset(0, 1),
              child: Material(
                color: Colors.transparent,
                child: Container(
                  width: double.infinity,
                  color: _isOffline ? Colors.red.shade600 : Colors.green.shade600,
                  child: SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isOffline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
                            color: Colors.white,
                            size: 14,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isOffline ? 'Offline' : 'Back Online',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
